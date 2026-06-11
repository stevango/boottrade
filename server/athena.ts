// Athena AI — B3 stock trend signal generator. Mirrors the Oracle AI
// pipeline but for stocks instead of sports value bets:
//   1. Pull the user's watchlist (or a curated default of liquid B3 large-caps)
//   2. Fetch daily history via brapi.dev
//   3. Run the existing analyzeSeries (SMA + slope + drawdown + vol)
//   4. Generate BUY/SELL/HOLD signals when conviction is high
//   5. Persist as brain_decisions (same UI handles them)

import { addBrainDecision, getDb, findPendingDecisionByAsset } from "./db";
import { robots, userRobots } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { fetchDailyHistory, isMarketDataConfigured } from "./marketData";
import { analyzeSeries } from "./signals";
import { postSignalToWebhook } from "./webhooks";
import { executeSignal } from "./oms";
import { getRoutingMode } from "./brokers/registry";

const ATHENA_SLUG = "athena-ai";

// Default watchlist of liquid B3 large-caps when the user hasn't set their
// own. Picked for high daily volume + diverse sectors so the robot has
// always-on candidates.
const DEFAULT_SYMBOLS = [
  "PETR4", "VALE3", "ITUB4", "BBDC4", "BBAS3", "B3SA3",
  "WEGE3", "RENT3", "EQTL3", "MGLU3", "RADL3", "PRIO3",
  "SUZB3", "ELET3", "CSAN3", "JBSS3", "RDOR3", "ABEV3",
];

const MIN_TREND_STRENGTH = 60;
const MAX_SIGNALS_PER_RUN = 8;
// brapi.dev free tier has tighter range limits than paid. Most large caps
// return at least 1y; some return 2y. We try 1y first and fall back to 6mo
// if the symbol rejects it.
const PRIMARY_RANGE = "1y";
const FALLBACK_RANGE = "6mo";

export async function getAthenaRobotId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const row = await db.select({ id: robots.id }).from(robots).where(eq(robots.slug, ATHENA_SLUG)).limit(1);
  return row[0]?.id ?? null;
}

export async function listAthenaActiveUsers(): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];
  const athenaId = await getAthenaRobotId();
  if (athenaId == null) return [];
  const rows = await db.select({ userId: userRobots.userId }).from(userRobots)
    .where(and(eq(userRobots.robotId, athenaId), eq(userRobots.status, "active")));
  return rows.map(r => r.userId);
}

type AthenaSignal = {
  symbol: string;
  side: "buy" | "sell" | "hold";
  confidence: number;          // 0-100
  reasoning: string;
  lastPrice: number;
  trend: "alta" | "baixa" | "lateral";
  trendStrength: number;
  sma50: number | null;
  sma200: number | null;
  oneYearReturnPct: number | null;
};

function tradeFromAnalysis(symbol: string, an: ReturnType<typeof analyzeSeries>): AthenaSignal | null {
  if (!an) return null;
  if (an.trendStrength < MIN_TREND_STRENGTH) return null;
  const oneYear = an.returns.find((r) => r.days === 252)?.percent ?? null;

  let side: "buy" | "sell" = "buy";
  let reasoning = "";

  if (an.trend === "alta") {
    side = "buy";
    const parts = [
      `Tendência de alta com força ${an.trendStrength}%.`,
      an.sma50 != null && an.lastPrice > an.sma50 ? `Preço (R$ ${an.lastPrice.toFixed(2)}) acima da MM50 (R$ ${an.sma50.toFixed(2)}).` : null,
      an.sma50 != null && an.sma200 != null && an.sma50 > an.sma200 ? "Golden Cross ativo (MM50 > MM200)." : null,
      oneYear != null ? `Retorno 12m: ${oneYear >= 0 ? "+" : ""}${oneYear.toFixed(1)}%.` : null,
    ].filter(Boolean);
    reasoning = parts.join(" ");
  } else if (an.trend === "baixa") {
    side = "sell";
    const parts = [
      `Tendência de baixa com força ${an.trendStrength}%.`,
      an.sma50 != null && an.lastPrice < an.sma50 ? `Preço (R$ ${an.lastPrice.toFixed(2)}) abaixo da MM50 (R$ ${an.sma50.toFixed(2)}).` : null,
      an.sma50 != null && an.sma200 != null && an.sma50 < an.sma200 ? "Death Cross ativo (MM50 < MM200)." : null,
      oneYear != null ? `Retorno 12m: ${oneYear >= 0 ? "+" : ""}${oneYear.toFixed(1)}%.` : null,
    ].filter(Boolean);
    reasoning = parts.join(" ");
  } else {
    // Lateral — Athena não sinaliza
    return null;
  }

  return {
    symbol, side, confidence: an.trendStrength, reasoning,
    lastPrice: an.lastPrice, trend: an.trend, trendStrength: an.trendStrength,
    sma50: an.sma50, sma200: an.sma200, oneYearReturnPct: oneYear,
  };
}

function signalAsset(s: AthenaSignal): string {
  // Format consistent with Oracle: "ASSET | TREND | SIDE"
  return `${s.symbol} | trend | ${s.side}`;
}

function reasoningFor(s: AthenaSignal): string {
  return `[athena:b3] ${s.symbol} @ R$ ${s.lastPrice.toFixed(2)} — ${s.reasoning}`;
}

type AthenaResult = { userId: number; created: number; analyzed: number; skipped: number; errors: number; error?: string };

async function getSymbolsForUser(_userId: number): Promise<string[]> {
  // Future: pull from user's watchlist. For now use the curated default
  // so every active user gets the same set of high-quality signals.
  return DEFAULT_SYMBOLS;
}

export async function runAthenaForUser(userId: number): Promise<AthenaResult> {
  const athenaId = await getAthenaRobotId();
  if (athenaId == null) return { userId, created: 0, analyzed: 0, skipped: 0, errors: 0, error: "Athena robot not in catalog" };
  if (!(await isMarketDataConfigured())) return { userId, created: 0, analyzed: 0, skipped: 0, errors: 0, error: "brapi.dev não configurada" };

  const symbols = await getSymbolsForUser(userId);
  let analyzed = 0, errors = 0, skipped = 0;
  const candidates: AthenaSignal[] = [];

  for (const sym of symbols) {
    try {
      let hist;
      try {
        hist = await fetchDailyHistory(sym, PRIMARY_RANGE);
      } catch (e) {
        // Free tier sometimes blocks longer ranges; fall back to 6mo.
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("403") || msg.includes("range") || msg.includes("plan")) {
          hist = await fetchDailyHistory(sym, FALLBACK_RANGE);
        } else {
          throw e;
        }
      }
      analyzed++;
      const an = analyzeSeries(hist.points);
      const sig = tradeFromAnalysis(sym, an);
      if (sig) candidates.push(sig);
      else skipped++;
    } catch (e) {
      errors++;
      console.warn(`[athena] ${sym} failed:`, e instanceof Error ? e.message : e);
    }
  }

  // Rank by trend strength (most confident first), cap to MAX per run.
  const ranked = candidates.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_SIGNALS_PER_RUN);

  let created = 0;
  for (const s of ranked) {
    const asset = signalAsset(s);
    try {
      const existing = await findPendingDecisionByAsset(userId, athenaId, asset, 48);
      if (existing) { skipped++; continue; }
      const r = await addBrainDecision(userId, athenaId, {
        decision: s.side === "buy" ? "buy" : "sell",
        asset,
        confidence: s.confidence,
        reasoning: reasoningFor(s),
        executedBy: "robot",
        outcome: "pending",
      });
      if (r.success) {
        created++;
        if (r.decisionId != null) {
          // Webhook OUT — fire-and-forget.
          void postSignalToWebhook({
            robot: "athena-ai",
            source: "athena",
            decisionId: r.decisionId,
            asset: s.symbol,
            side: s.side,
            confidence: s.confidence,
            reasoning: s.reasoning,
            bestPrice: s.lastPrice,
            generatedAt: new Date().toISOString(),
          });
          // OMS execution — if routing is enabled, send to the active broker.
          // Default stake R$ 100 capped by OMS_MAX_PER_ORDER_BRL.
          if (s.side === "buy" || s.side === "sell") {
            void (async () => {
              const mode = await getRoutingMode();
              if (mode === "off") return;
              const r2 = await executeSignal({
                userId,
                decisionId: r.decisionId,
                symbol: s.symbol,
                side: s.side === "buy" ? "BUY" : "SELL",
                stake: 100,
                source: "athena",
                reasoning: s.reasoning,
              });
              if (r2.ok) console.log(`[athena→oms] ${s.symbol} ${s.side} via ${r2.route} status=${r2.status}`);
              else console.warn(`[athena→oms] ${s.symbol} ${s.side} bloqueado: ${r2.reason}`);
            })();
          }
        }
      }
    } catch (e) {
      errors++;
      console.warn("[athena] addBrainDecision failed:", e instanceof Error ? e.message : e);
    }
  }

  return { userId, created, analyzed, skipped, errors };
}

export async function runAthenaForAllActive(): Promise<AthenaResult[]> {
  const userIds = await listAthenaActiveUsers();
  if (userIds.length === 0) return [];
  const out: AthenaResult[] = [];
  for (const uid of userIds) out.push(await runAthenaForUser(uid));
  return out;
}
