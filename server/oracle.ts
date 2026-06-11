// Oracle AI — sports value-bet signal generator. Scans configured providers
// for value bets and persists each one as a brain decision so the user sees
// it on the "Sinais ao Vivo" page and the robot brain can learn from the
// outcome (won/lost) over time.

import { addBrainDecision, getDb, resolveDecision, getUserBalance, addSignalAdvice, getAppSetting, findPendingDecisionByAsset, expireStalePendingDecisions } from "./db";
import { robots, userRobots, brainDecisions } from "../drizzle/schema";
import { and, eq, gte } from "drizzle-orm";
import { isOddsConfigured, fetchOpportunities as fetchTheOddsOpportunities, fetchScores, type ScoreEvent } from "./oddsData";
import { isOddsIoConfigured, fetchOpportunities as fetchOddsIoOpportunities } from "./oddsIo";
import { isApiFootballConfigured, analyzeMatch, buildAdvisorPrompt, computeBetIntelligence, type AdviseInput } from "./matchAnalysis";
import { isAutoBetEnabled, getAutoBetMaxStakeBrl, placeBetForSignal } from "./betfairExecutor";
import { isLLMConfigured, chatComplete } from "./llm";
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
// odds-api.io is league-based; we discover the actual available leagues per
// sport instead of hardcoding slugs (the slug for Brasileirão changes
// between providers and we previously guessed wrong — "brazil-serie-a"
// returned 404). The World Cup slug is reliable so we keep it as a fixed
// fallback when discovery fails or runs out of quota.
const FIXED_FALLBACK_LEAGUES: { sport: string; league: string }[] = [
  { sport: "football", league: "international-world-cup" },
];
const DISCOVERY_SPORTS = ["football", "basketball"];
const DISCOVERY_MAX_LEAGUES_PER_SPORT = 4;

type DiscoveredLeague = { sport: string; league: string };
let leagueDiscoveryCache: { leagues: DiscoveredLeague[]; fetchedAt: number } | null = null;
const LEAGUE_DISCOVERY_TTL = 6 * 60 * 60 * 1000;

async function discoverActiveLeagues(): Promise<DiscoveredLeague[]> {
  if (leagueDiscoveryCache && Date.now() - leagueDiscoveryCache.fetchedAt < LEAGUE_DISCOVERY_TTL) {
    return leagueDiscoveryCache.leagues;
  }
  // Lazy import to avoid pulling oddsIo into oracle's top-level cycle.
  const { fetchLeagues } = await import("./oddsIo");
  const found: DiscoveredLeague[] = [...FIXED_FALLBACK_LEAGUES];
  for (const sport of DISCOVERY_SPORTS) {
    try {
      const leagues = await fetchLeagues(sport);
      // Prefer leagues whose name suggests current-season top competitions —
      // we pick the first N after a light name filter.
      const ranked = leagues
        .filter((l) => l.slug && !/u17|u19|u20|youth|reserve|women/i.test(l.name))
        .slice(0, DISCOVERY_MAX_LEAGUES_PER_SPORT);
      for (const l of ranked) {
        if (!found.some((f) => f.sport === sport && f.league === l.slug)) {
          found.push({ sport, league: l.slug });
        }
      }
    } catch (e) {
      console.warn(`[oracle] discoverActiveLeagues sport=${sport} failed:`, e instanceof Error ? e.message : e);
    }
  }
  leagueDiscoveryCache = { leagues: found, fetchedAt: Date.now() };
  return found;
}

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

// Soft circuit-breaker for The Odds API: when quota errors trigger, we skip
// the next scans for an hour so we don't keep hammering and getting 401s
// every minute. Reset when the calendar month rolls over (caller decides
// when to invalidate).
let theOddsQuotaCooldownUntil: number = 0;

async function scanTheOdds(): Promise<{ results: { bets: ValueBet[]; source: string }[]; errors: string[]; configured: boolean }> {
  if (!(await isOddsConfigured())) return { results: [], errors: [], configured: false };
  if (Date.now() < theOddsQuotaCooldownUntil) {
    return { results: [], errors: [`theOdds em cooldown até ${new Date(theOddsQuotaCooldownUntil).toLocaleString("pt-BR")} (quota mensal esgotada)`], configured: true };
  }
  const results: { bets: ValueBet[]; source: string }[] = [];
  const errors: string[] = [];
  for (const sport of DEFAULT_SPORTS_THEODDS) {
    try {
      const { valueBets } = await fetchTheOddsOpportunities({ sport, regions: "eu,uk", markets: "h2h", edgeThresholdPct: MIN_EDGE_PCT });
      if (valueBets.length > 0) results.push({ bets: valueBets, source: `theOdds:${sport}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`theOdds:${sport} → ${msg.slice(0, 120)}`);
      console.warn(`[oracle] theOdds ${sport} failed:`, msg);
      // 401 + "quota" or 429 → no point trying more sports this scan;
      // they all share the same monthly bucket. Set cooldown to next hour.
      if (msg.includes("401") || msg.includes("429") || msg.toLowerCase().includes("quota")) {
        theOddsQuotaCooldownUntil = Date.now() + 60 * 60 * 1000;
        break;
      }
    }
  }
  return { results, errors, configured: true };
}

async function scanOddsIo(): Promise<{ results: { bets: ValueBet[]; source: string }[]; errors: string[]; configured: boolean }> {
  if (!(await isOddsIoConfigured())) return { results: [], errors: [], configured: false };
  const results: { bets: ValueBet[]; source: string }[] = [];
  const errors: string[] = [];
  const leagues = await discoverActiveLeagues();
  for (const { sport, league } of leagues) {
    try {
      const { valueBets } = await fetchOddsIoOpportunities({ sport, league, edgeThresholdPct: MIN_EDGE_PCT });
      if (valueBets.length > 0) results.push({ bets: valueBets, source: `oddsIo:${league}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Stop scanning further leagues if we hit a rate limit — they all share
      // the same quota window.
      if (msg.includes("429") || msg.toLowerCase().includes("rate")) {
        errors.push(`oddsIo:${league} → rate limit, parando`);
        break;
      }
      errors.push(`oddsIo:${league} → ${msg.slice(0, 120)}`);
      console.warn(`[oracle] oddsIo ${league} failed:`, msg);
    }
  }
  return { results, errors, configured: true };
}

// Auto-advisor: after a scan creates new signals, run the consultor on the
// top N by edge so the user opens /signals already finding recommendations.
// Quota-bounded: 1 LLM + ~9 API-Football calls per advised signal. The
// admin can toggle this off (AUTO_ADVISE_ENABLED=false) or change N
// (AUTO_ADVISE_TOP_N=0..10) from /integrations without redeploy.
const AUTO_ADVISE_TOP_N_DEFAULT = 5;

async function getAutoAdviseConfig(): Promise<{ enabled: boolean; topN: number }> {
  const enabledRaw = await getAppSetting("AUTO_ADVISE_ENABLED");
  const topNRaw = await getAppSetting("AUTO_ADVISE_TOP_N");
  const enabled = enabledRaw == null ? true : enabledRaw.toLowerCase() !== "false";
  const topN = topNRaw ? Math.max(0, Math.min(10, parseInt(topNRaw, 10) || AUTO_ADVISE_TOP_N_DEFAULT)) : AUTO_ADVISE_TOP_N_DEFAULT;
  return { enabled, topN };
}

async function autoAdviseSignal(userId: number, decisionId: number, bet: ValueBet, source: string, bankroll: number): Promise<boolean> {
  try {
    const [home, away] = bet.event.split("×").map((s) => s.trim());
    if (!home || !away) return false;
    const analysis = await analyzeMatch(home, away);
    const input: AdviseInput = {
      home, away,
      market: bet.market,
      outcome: bet.outcome,
      bestBook: bet.bestBook,
      bestPrice: bet.bestPrice,
      avgPrice: bet.avgPrice,
      edgePct: bet.edgePct,
      commence: bet.commence,
    };
    const intelligence = computeBetIntelligence(input, analysis, bankroll);
    const prompt = buildAdvisorPrompt(input, analysis, bankroll, intelligence);
    const advice = await chatComplete([
      { role: "system", content: "Você é um consultor de apostas esportivas estatístico, direto e honesto. Nunca prometa ganho garantido. Sempre considere risco de banca. Responda em português, parágrafos curtos." },
      { role: "user", content: prompt },
    ]);
    await addSignalAdvice(userId, {
      decisionId,
      home, away,
      market: bet.market, outcome: bet.outcome,
      bestBook: bet.bestBook, bestPrice: bet.bestPrice,
      avgPrice: bet.avgPrice, edgePct: bet.edgePct,
      commence: bet.commence,
      prompt, advice, model: "auto",
      decision: intelligence.decision,
      recommendedStakeBrl: intelligence.recommendedStakeBrl,
    });

    // Auto-bet on Betfair if enabled AND advisor said SIM AND we have a
    // sensible stake. Capped by BETFAIR_AUTO_BET_MAX_STAKE_BRL setting so a
    // bug never burns more than the configured cobaia amount.
    if (intelligence.decision === "SIM" && intelligence.recommendedStakeBrl > 0 && await isAutoBetEnabled()) {
      const cap = await getAutoBetMaxStakeBrl();
      const stake = Math.min(intelligence.recommendedStakeBrl, cap);
      if (stake > 0 && bet.bestPrice > 1) {
        try {
          const r = await placeBetForSignal({
            userId, decisionId,
            home, away,
            market: bet.market, outcome: bet.outcome,
            bestPrice: bet.bestPrice, stake,
            commence: bet.commence,
            source: "betfair_auto",
          });
          if (r.ok) console.log(`[oracle] auto-bet OK decisionId=${decisionId} stake=${stake} matched=${r.matchedPrice}`);
          else console.warn(`[oracle] auto-bet falhou decisionId=${decisionId}: ${r.reason}`);
        } catch (e) {
          console.warn(`[oracle] auto-bet exceção decisionId=${decisionId}:`, e instanceof Error ? e.message : e);
        }
      }
    }
    return true;
  } catch (e) {
    console.warn(`[oracle] auto-advise failed for decision ${decisionId} (${source}):`, e instanceof Error ? e.message : e);
    return false;
  }
}

export async function runOracleForUser(userId: number): Promise<OracleResult> {
  const oracleId = await getOracleRobotId();
  if (oracleId == null) return { userId, created: 0, sources: [], error: "Oracle robot not in catalog" };

  const [scan1, scan2] = await Promise.all([scanTheOdds(), scanOddsIo()]);
  const all = [...scan1.results, ...scan2.results];
  if (all.length === 0) {
    const parts: string[] = [];
    if (!scan1.configured) parts.push("The Odds API não configurada");
    else if (scan1.errors.length > 0) parts.push(`The Odds API falhou: ${scan1.errors[0]}`);
    else parts.push("The Odds API: sem value bets ≥ 2%");
    if (!scan2.configured) parts.push("Odds-API.io não configurada");
    else if (scan2.errors.length > 0) parts.push(`Odds-API.io falhou: ${scan2.errors[0]}`);
    else parts.push("Odds-API.io: sem value bets ≥ 2%");
    return { userId, created: 0, sources: [], error: parts.join(" · ") };
  }

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
  let skippedDupes = 0;
  const insertedForAdvise: { decisionId: number; bet: ValueBet; source: string }[] = [];
  for (const { bet, source } of ranked) {
    const asset = signalAsset(bet);
    try {
      // Dedup: if the same (event | market | outcome) is already pending in
      // the last 48h for this user+robot, skip — Oracle ticks hourly and we
      // don't want 24 copies of the same Spain × Cape Verde sitting around.
      const existing = await findPendingDecisionByAsset(userId, oracleId, asset, 48);
      if (existing) { skippedDupes++; continue; }
      const r = await addBrainDecision(userId, oracleId, {
        decision: "buy" as const,
        asset,
        confidence: bet.edgePct,
        reasoning: reasoningFor(bet, source),
        executedBy: "robot" as const,
        outcome: "pending" as const,
      });
      if (r.success) {
        created++;
        if (r.decisionId != null) insertedForAdvise.push({ decisionId: r.decisionId, bet, source });
      }
    } catch (e) {
      console.warn("[oracle] addBrainDecision failed:", e instanceof Error ? e.message : e);
    }
  }
  if (skippedDupes > 0) console.log(`[oracle] ${skippedDupes} duplicate signals skipped for user ${userId}`);

  // Auto-orientação: run the consultor on the top N edges if both API-Football
  // and the LLM are configured AND admin hasn't disabled it. Fire-and-forget
  // so the scan doesn't block; N is read from app_settings each tick so the
  // admin's slider takes effect immediately.
  void (async () => {
    if (insertedForAdvise.length === 0) return;
    const cfg = await getAutoAdviseConfig();
    if (!cfg.enabled || cfg.topN === 0) return;
    if (!(await isApiFootballConfigured()) || !(await isLLMConfigured())) return;
    const bankroll = await getUserBalance(userId);
    const top = insertedForAdvise.slice(0, cfg.topN);
    let advised = 0;
    for (const { decisionId, bet, source } of top) {
      if (await autoAdviseSignal(userId, decisionId, bet, source, bankroll)) advised++;
    }
    if (advised > 0) console.log(`[oracle] auto-advised ${advised}/${top.length} top signals for user ${userId}`);
  })();

  const sources = Array.from(new Set(ranked.map(r => r.source.split(":")[0])));
  return { userId, created, sources };
}

// =============================================================================
// Auto-resolve pending signals — Phase 2
// =============================================================================

// Parse "{home} × {away} | {market} | {outcome}" back out of the asset field.
const ASSET_RE = /^(.+?)\s*×\s*(.+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)$/;
// Reasoning prefix "[theOdds:soccer_xyz] ..."
const SOURCE_RE = /^\[theOdds:([^\]]+)\]/;

type ParsedSignal = { id: number; home: string; away: string; market: string; outcome: string; sport: string };

function parseSignal(s: { id: number; asset: string; reasoning: string | null }): ParsedSignal | null {
  const am = ASSET_RE.exec(s.asset);
  if (!am) return null;
  const sm = s.reasoning ? SOURCE_RE.exec(s.reasoning) : null;
  if (!sm) return null; // only theOdds scores endpoint supported in Phase 2
  return { id: s.id, home: am[1].trim(), away: am[2].trim(), market: am[3].trim().toLowerCase(), outcome: am[4].trim(), sport: sm[1].trim() };
}

// Loose team-name comparison: case-insensitive, whitespace-normalized.
function teamMatch(a: string, b: string): boolean {
  const n = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return n(a) === n(b);
}

// Decide whether the bet won given home/away scores. Only h2h is supported in
// Phase 2 (over 90% of our signals). Other markets stay pending until the user
// marks them manually.
function decideH2H(home: string, away: string, outcome: string, scores: { name: string; score: string }[]): "profit" | "loss" | null {
  const sm = new Map(scores.map((s) => [s.name.toLowerCase().trim(), parseInt(s.score, 10)]));
  const hs = sm.get(home.toLowerCase().trim());
  const as_ = sm.get(away.toLowerCase().trim());
  if (hs == null || as_ == null || Number.isNaN(hs) || Number.isNaN(as_)) return null;
  const winner = hs > as_ ? "home" : as_ > hs ? "away" : "draw";
  const o = outcome.toLowerCase().trim();
  // Outcome can be the team name ("Brazil"), a side ("Home"/"Away"/"Draw"),
  // or "Tie" (some feeds). Normalize.
  let bet: "home" | "away" | "draw";
  if (o === "draw" || o === "tie") bet = "draw";
  else if (o === "home" || teamMatch(o, home)) bet = "home";
  else if (o === "away" || teamMatch(o, away)) bet = "away";
  else return null;
  return bet === winner ? "profit" : "loss";
}

type ResolveResult = { userId: number; resolved: number; checked: number; errors: number; expired: number };

// Parses "em 15/06/2026, 16:00:00" out of the reasoning string into ms epoch.
function parseEventDate(reasoning: string | null): number | null {
  if (!reasoning) return null;
  const m = /em\s+(\d{2})\/(\d{2})\/(\d{4}),?\s*(\d{2}):(\d{2})(?::(\d{2}))?/.exec(reasoning);
  if (!m) return null;
  const [, dd, mm, yyyy, h, min, s] = m;
  const t = Date.UTC(+yyyy, +mm - 1, +dd, +h, +min, +(s || "0"));
  return Number.isFinite(t) ? t : null;
}

export async function tryResolveOracleSignals(userId: number): Promise<ResolveResult> {
  const oracleId = await getOracleRobotId();
  if (oracleId == null) return { userId, resolved: 0, checked: 0, errors: 0, expired: 0 };

  // First sweep: cleanup signals for games that already played out > 2 days
  // ago but never got an automatic resolution (non-h2h markets, missing
  // /scores match, etc). Mark them neutral so they stop bloating the
  // pending count.
  const expiredResult = await expireStalePendingDecisions(userId, oracleId, 7);

  if (!(await isOddsConfigured())) return { userId, resolved: 0, checked: 0, errors: 0, expired: expiredResult.expired };
  const db = await getDb();
  if (!db) return { userId, resolved: 0, checked: 0, errors: 0, expired: expiredResult.expired };

  // Pull recent pending signals for this user — last 14 days, oracle only.
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const pending = await db.select({
    id: brainDecisions.id,
    asset: brainDecisions.asset,
    reasoning: brainDecisions.reasoning,
  }).from(brainDecisions).where(and(
    eq(brainDecisions.userId, userId),
    eq(brainDecisions.robotId, oracleId),
    eq(brainDecisions.outcome, "pending"),
    gte(brainDecisions.createdAt, cutoff),
  )).limit(500);

  if (pending.length === 0) return { userId, resolved: 0, checked: 0, errors: 0, expired: expiredResult.expired };

  // Skip signals whose game hasn't happened yet — no point asking /scores.
  const now = Date.now();
  const playable = pending.filter((p) => {
    const ts = parseEventDate(p.reasoning);
    if (ts == null) return true;          // unknown date — try anyway
    return ts < now + 60 * 60 * 1000;     // started or starting within 1h
  });

  // Parse + group by sport so we minimize /scores calls.
  const parsed = playable.map((p) => parseSignal({ id: p.id, asset: p.asset, reasoning: p.reasoning })).filter((p): p is ParsedSignal => p != null);
  const bySport = new Map<string, ParsedSignal[]>();
  for (const p of parsed) {
    if (!bySport.has(p.sport)) bySport.set(p.sport, []);
    bySport.get(p.sport)!.push(p);
  }

  let resolved = 0, errors = 0;
  for (const [sport, signals] of Array.from(bySport.entries())) {
    let scoreEvents: ScoreEvent[];
    try {
      // Look back 7 days for finished games — catches more matches than the
      // previous 3-day window and is well within The Odds API quota.
      scoreEvents = await fetchScores(sport, 7);
    } catch (e) {
      errors++;
      console.warn(`[oracle] fetchScores(${sport}) failed:`, e instanceof Error ? e.message : e);
      continue;
    }
    for (const s of signals) {
      // Only h2h supported in Phase 2.
      if (s.market !== "h2h" && s.market !== "ml" && s.market !== "moneyline") continue;
      const ev = scoreEvents.find((e) => e.completed && e.scores && teamMatch(e.home_team, s.home) && teamMatch(e.away_team, s.away));
      if (!ev || !ev.scores) continue;
      const outcome = decideH2H(s.home, s.away, s.outcome, ev.scores);
      if (!outcome) continue;
      try {
        await resolveDecision(userId, s.id, outcome, 0);
        resolved++;
      } catch (e) {
        errors++;
        console.warn(`[oracle] resolveDecision(${s.id}) failed:`, e instanceof Error ? e.message : e);
      }
    }
  }
  return { userId, resolved, checked: parsed.length, errors, expired: expiredResult.expired };
}

export async function tryResolveAllOracleSignals(): Promise<ResolveResult[]> {
  const userIds = await listOracleActiveUsers();
  const out: ResolveResult[] = [];
  for (const uid of userIds) out.push(await tryResolveOracleSignals(uid));
  return out;
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
