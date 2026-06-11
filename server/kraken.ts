// Kraken AI — crypto signal generator. Pulls daily candles from Mercado
// Bitcoin (public, no auth) for the top BRL pairs, applies the same
// trend-following logic as Athena, and produces BUY/SELL signals routed
// through the OMS (paper or mercado_bitcoin).

import { addBrainDecision, getDb, findPendingDecisionByAsset } from "./db";
import { robots, userRobots } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { fetchCryptoCandles } from "./cryptoData";
import { analyzeSeries } from "./signals";
import { postSignalToWebhook } from "./webhooks";
import { executeSignal } from "./oms";
import { getRoutingMode } from "./brokers/registry";

const KRAKEN_SLUG = "kraken-ai";

const DEFAULT_PAIRS = [
  "BTCBRL", "ETHBRL", "SOLBRL", "AVAXBRL", "ADABRL",
  "MATICBRL", "LINKBRL", "DOTBRL", "XRPBRL",
];

const MIN_TREND_STRENGTH = 60;
const MAX_SIGNALS_PER_RUN = 5;

export async function getKrakenRobotId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.select({ id: robots.id }).from(robots).where(eq(robots.slug, KRAKEN_SLUG)).limit(1);
  return row[0]?.id ?? null;
}

export async function listKrakenActiveUsers(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const id = await getKrakenRobotId();
  if (id == null) return [];
  const rows = await db.select({ userId: userRobots.userId }).from(userRobots)
    .where(and(eq(userRobots.robotId, id), eq(userRobots.status, "active")));
  return rows.map(r => r.userId);
}

type KrakenSignal = {
  symbol: string;
  side: "buy" | "sell";
  confidence: number;
  reasoning: string;
  lastPrice: number;
};

type KrakenResult = { userId: number; created: number; analyzed: number; skipped: number; errors: number; error?: string };

export async function runKrakenForUser(userId: number): Promise<KrakenResult> {
  const robotId = await getKrakenRobotId();
  if (robotId == null) return { userId, created: 0, analyzed: 0, skipped: 0, errors: 0, error: "Kraken robot not in catalog" };

  const candidates: KrakenSignal[] = [];
  let analyzed = 0, errors = 0, skipped = 0;

  for (const pair of DEFAULT_PAIRS) {
    try {
      const candles = await fetchCryptoCandles(pair, "1d", 90);
      analyzed++;
      const points = candles.map((c) => ({ date: c.timestamp, close: c.close }));
      const an = analyzeSeries(points);
      if (!an || an.trendStrength < MIN_TREND_STRENGTH || an.trend === "lateral") { skipped++; continue; }
      const side: "buy" | "sell" = an.trend === "alta" ? "buy" : "sell";
      const reasoning = `Tendência ${an.trend} força ${an.trendStrength}%. Último: R$ ${an.lastPrice.toFixed(2)}. ${an.summary}`;
      candidates.push({ symbol: pair, side, confidence: an.trendStrength, reasoning, lastPrice: an.lastPrice });
    } catch (e) {
      errors++;
      console.warn(`[kraken] ${pair} failed:`, e instanceof Error ? e.message : e);
    }
  }

  const ranked = candidates.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_SIGNALS_PER_RUN);

  let created = 0;
  for (const s of ranked) {
    const asset = `${s.symbol} | trend | ${s.side}`;
    try {
      const existing = await findPendingDecisionByAsset(userId, robotId, asset, 48);
      if (existing) { skipped++; continue; }
      const r = await addBrainDecision(userId, robotId, {
        decision: s.side,
        asset,
        confidence: s.confidence,
        reasoning: `[kraken:crypto] ${s.symbol} @ R$ ${s.lastPrice.toFixed(2)} — ${s.reasoning}`,
        executedBy: "robot",
        outcome: "pending",
      });
      if (r.success) {
        created++;
        if (r.decisionId != null) {
          void postSignalToWebhook({
            robot: "kraken-ai",
            source: "athena",
            decisionId: r.decisionId,
            asset: s.symbol,
            side: s.side,
            confidence: s.confidence,
            reasoning: s.reasoning,
            bestPrice: s.lastPrice,
            generatedAt: new Date().toISOString(),
          });
          // Auto-execute via OMS when routing is on.
          void (async () => {
            const mode = await getRoutingMode();
            if (mode === "off") return;
            const r2 = await executeSignal({
              userId,
              decisionId: r.decisionId!,
              symbol: s.symbol,
              side: s.side === "buy" ? "BUY" : "SELL",
              stake: 50,  // tiny default; user can override via OMS config
              source: "athena",
              reasoning: s.reasoning,
            });
            if (r2.ok) console.log(`[kraken→oms] ${s.symbol} ${s.side} via ${r2.route} status=${r2.status}`);
            else console.warn(`[kraken→oms] ${s.symbol} ${s.side} bloqueado: ${r2.reason}`);
          })();
        }
      }
    } catch (e) {
      errors++;
      console.warn("[kraken] addBrainDecision failed:", e instanceof Error ? e.message : e);
    }
  }

  return { userId, created, analyzed, skipped, errors };
}

export async function runKrakenForAllActive(): Promise<KrakenResult[]> {
  const userIds = await listKrakenActiveUsers();
  if (userIds.length === 0) return [];
  const out: KrakenResult[] = [];
  for (const uid of userIds) out.push(await runKrakenForUser(uid));
  return out;
}
