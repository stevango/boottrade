// Oracle AI — sports value-bet signal generator. Scans configured providers
// for value bets and persists each one as a brain decision so the user sees
// it on the "Sinais ao Vivo" page and the robot brain can learn from the
// outcome (won/lost) over time.

import { addBrainDecision, getDb } from "./db";
import { robots, userRobots } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { isOddsConfigured, fetchOpportunities as fetchTheOddsOpportunities } from "./oddsData";
import { isOddsIoConfigured, fetchOpportunities as fetchOddsIoOpportunities } from "./oddsIo";
import type { ValueBet } from "./oddsAnalysis";

const ORACLE_SLUG = "oracle-ai";

// Default sports the Oracle AI scans. Chosen for high coverage in
// Bet365/Betano-class bookmakers and broad calendar (Brasileirão + Copa do
// Mundo 2026 + ligas europeias em junho/julho).
const DEFAULT_SPORTS_THEODDS = [
  "soccer_brazil_campeonato",
  "soccer_fifa_world_cup",
  "soccer_uefa_champs_league",
  "soccer_epl",
];
// odds-api.io is league-based; default to high-coverage leagues only.
const DEFAULT_LEAGUES_ODDSIO: { sport: string; league: string }[] = [
  { sport: "football", league: "brazil-serie-a" },
  { sport: "football", league: "international-world-cup" },
];

// Minimum edge % to persist as a signal. Below this it's noise.
const MIN_EDGE_PCT = 2;
// Cap to avoid flooding the brain with hundreds of bets per scan
const MAX_SIGNALS_PER_RUN = 20;

type OracleResult = { userId: number; created: number; sources: string[]; error?: string };

export async function getOracleRobotId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.select({ id: robots.id }).from(robots).where(eq(robots.slug, ORACLE_SLUG)).limit(1);
  return row[0]?.id ?? null;
}

export async function listOracleActiveUsers(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const oracleId = await getOracleRobotId();
  if (oracleId == null) return [];
  const rows = await db.select({ userId: userRobots.userId }).from(userRobots)
    .where(and(eq(userRobots.robotId, oracleId), eq(userRobots.status, "active")));
  return rows.map(r => r.userId);
}

// Dedupe key for a value bet so re-running the scan within the same window
// doesn't create dozens of duplicates for the same edge.
function signalAsset(vb: ValueBet): string {
  // e.g. "Mexico × South Africa | ML | home (0)"
  return `${vb.event} | ${vb.market} | ${vb.outcome}${vb.point != null ? ` (${vb.point})` : ""}`;
}

function reasoningFor(vb: ValueBet, source: string): string {
  const when = vb.commence ? ` em ${new Date(vb.commence).toLocaleString("pt-BR")}` : "";
  return `[${source}] ${vb.bestPrice.toFixed(2)} @ ${vb.bestBook} vs média ${vb.avgPrice.toFixed(2)} entre ${vb.booksCount} casas (edge ${vb.edgePct.toFixed(1)}%)${when}.`;
}

async function scanTheOdds(): Promise<{ bets: ValueBet[]; source: string }[]> {
  if (!(await isOddsConfigured())) return [];
  const out: { bets: ValueBet[]; source: string }[] = [];
  for (const sport of DEFAULT_SPORTS_THEODDS) {
    try {
      const { valueBets } = await fetchTheOddsOpportunities({ sport, regions: "eu,uk", markets: "h2h", edgeThresholdPct: MIN_EDGE_PCT });
      if (valueBets.length > 0) out.push({ bets: valueBets, source: `theOdds:${sport}` });
    } catch (e) {
      console.warn(`[oracle] theOdds ${sport} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

async function scanOddsIo(): Promise<{ bets: ValueBet[]; source: string }[]> {
  if (!(await isOddsIoConfigured())) return [];
  const out: { bets: ValueBet[]; source: string }[] = [];
  for (const { sport, league } of DEFAULT_LEAGUES_ODDSIO) {
    try {
      const { valueBets } = await fetchOddsIoOpportunities({ sport, league, edgeThresholdPct: MIN_EDGE_PCT });
      if (valueBets.length > 0) out.push({ bets: valueBets, source: `oddsIo:${league}` });
    } catch (e) {
      console.warn(`[oracle] oddsIo ${league} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export async function runOracleForUser(userId: number): Promise<OracleResult> {
  const oracleId = await getOracleRobotId();
  if (oracleId == null) return { userId, created: 0, sources: [], error: "Oracle robot not in catalog" };

  const [theOddsResults, oddsIoResults] = await Promise.all([scanTheOdds(), scanOddsIo()]);
  const all = [...theOddsResults, ...oddsIoResults];
  if (all.length === 0) return { userId, created: 0, sources: [], error: "Nenhum feed configurado ou todos falharam" };

  // Flatten + dedupe by (asset). Keep highest edge for each.
  const seen = new Map<string, { bet: ValueBet; source: string }>();
  for (const { bets, source } of all) {
    for (const bet of bets) {
      const key = signalAsset(bet);
      const prev = seen.get(key);
      if (!prev || bet.edgePct > prev.bet.edgePct) seen.set(key, { bet, source });
    }
  }
  const ranked = Array.from(seen.values()).sort((a, b) => b.bet.edgePct - a.bet.edgePct).slice(0, MAX_SIGNALS_PER_RUN);

  let created = 0;
  for (const { bet, source } of ranked) {
    try {
      const r = await addBrainDecision(userId, oracleId, {
        decision: "buy" as const,
        asset: signalAsset(bet),
        confidence: bet.edgePct,
        reasoning: reasoningFor(bet, source),
        executedBy: "robot" as const,
        outcome: "pending" as const,
      });
      if (r.success) created++;
    } catch (e) {
      console.warn("[oracle] addBrainDecision failed:", e instanceof Error ? e.message : e);
    }
  }

  const sources = Array.from(new Set(ranked.map(r => r.source.split(":")[0])));
  return { userId, created, sources };
}

export async function runOracleForAllActive(): Promise<OracleResult[]> {
  const userIds = await listOracleActiveUsers();
  if (userIds.length === 0) return [];
  const results: OracleResult[] = [];
  for (const uid of userIds) {
    const r = await runOracleForUser(uid);
    results.push(r);
  }
  return results;
}
