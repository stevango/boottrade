// Betfair execution layer — turns Oracle signals into real bets on the
// Betfair Brazil (.bet.br) exchange.
//
// Pipeline:
//   1. user has a Betfair broker connection (broker_connections table)
//   2. Oracle generates a SIM signal with bestPrice, recommendedStakeBrl
//   3. either user clicks "Apostar agora" OR auto-bet toggle fires
//   4. findMarketForSignal locates the Betfair marketId + selectionId
//   5. validatePrice checks the live price hasn't drifted too far
//   6. placeBet sends the order; we persist a row in `bets`
//   7. resolveBets (called by scheduler) reads listClearedOrders and
//      marks settled rows with real profit + updates the brain decision

import { and, desc, eq } from "drizzle-orm";
import { bets, brokerConnections, brainDecisions, signalAdvice } from "../drizzle/schema";
import { getDb, getAppSetting, setAppSetting } from "./db";
import { decryptSecret } from "./crypto";
import { fetchBetfairFunds, findMarketsForEvent, listMarketBook, placeBet, listClearedOrders, type BetfairCreds, type PlaceBetResult } from "./betfair";

// =============================================================================
// Credential loading
// =============================================================================

async function loadBetfairCreds(userId: number): Promise<BetfairCreds | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brokerConnections)
    .where(and(eq(brokerConnections.userId, userId), eq(brokerConnections.broker, "betfair")))
    .limit(1);
  if (rows.length === 0) return null;
  const enc = rows[0].credentials;
  if (!enc) return null;
  try {
    const json = JSON.parse(decryptSecret(enc));
    if (!json.appKey || !json.username || !json.password) return null;
    return json as BetfairCreds;
  } catch {
    return null;
  }
}

// =============================================================================
// Market matching — find the Betfair market for a signal
// =============================================================================

// Normalize a team name for fuzzy matching. Lowercase, strip accents and
// non-alphanumeric, collapse whitespace. So "São Paulo FC" and "Sao Paulo"
// both become "saopaulo" and can compare.
function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bfc\b|\bcf\b|\bcd\b|\bclub\b|\bnational\b|\bteam\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  // Trigram overlap as a fallback for slight mismatches.
  const tri = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 2; i++) set.add(s.slice(i, i + 3));
    return set;
  };
  const ta = tri(na), tb = tri(nb);
  let common = 0;
  for (const t of Array.from(ta)) if (tb.has(t)) common++;
  return common / Math.max(1, Math.max(ta.size, tb.size));
}

export type FindMarketResult =
  | { ok: true; marketId: string; selectionId: number; runnerName: string; marketName: string; eventName: string; eventStartTime: string }
  | { ok: false; reason: string };

export async function findMarketForSignal(creds: BetfairCreds, input: {
  home: string; away: string; market: string; outcome: string; commence?: string;
}): Promise<FindMarketResult> {
  // For Phase 1 we only target MATCH_ODDS (h2h / 1X2). Other markets fall
  // back to "manual" so the user is told to bet on their own bookmaker.
  const marketTypeCode = "MATCH_ODDS";
  const m = input.market.toLowerCase();
  if (!(m === "h2h" || m === "ml" || m === "moneyline" || m === "1x2" || m === "match winner")) {
    return { ok: false, reason: `Mercado "${input.market}" não suportado em auto-execução. Apenas h2h por enquanto.` };
  }

  const startTime = input.commence ? new Date(input.commence) : new Date();
  const textQuery = `${input.home} ${input.away}`;
  let markets;
  try {
    markets = await findMarketsForEvent(creds, { textQuery, startTime, windowHours: 12, marketTypeCodes: [marketTypeCode], maxResults: 5 });
  } catch (e) {
    return { ok: false, reason: `Erro ao buscar mercados na Betfair: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (markets.length === 0) {
    return { ok: false, reason: `Nenhum mercado MATCH_ODDS encontrado na Betfair pra "${input.home} × ${input.away}" perto de ${startTime.toLocaleString("pt-BR")}` };
  }

  // Rank markets by event name similarity to our home/away combo.
  let best: { market: typeof markets[number]; score: number } | null = null;
  for (const m of markets) {
    const eventName = m.event?.name ?? "";
    const score = Math.max(
      similarity(eventName, `${input.home} v ${input.away}`),
      similarity(eventName, `${input.home} vs ${input.away}`),
      similarity(eventName, `${input.home} ${input.away}`),
    );
    if (!best || score > best.score) best = { market: m, score };
  }
  if (!best || best.score < 0.5) {
    return { ok: false, reason: `Match fraco: melhor candidato "${best?.market.event?.name}" (score ${best?.score.toFixed(2)})` };
  }

  // Find the right runner based on the outcome.
  const outcome = input.outcome.toLowerCase().trim();
  let targetName: string;
  if (outcome === "home") targetName = input.home;
  else if (outcome === "away") targetName = input.away;
  else if (outcome === "draw" || outcome === "tie") targetName = "Draw";
  else targetName = input.outcome;

  const runners = best.market.runners ?? [];
  let runner = runners.find((r) => normalizeName(r.runnerName) === normalizeName(targetName));
  if (!runner) {
    // Fall back to similarity.
    let bestRunner: { r: typeof runners[number]; s: number } | null = null;
    for (const r of runners) {
      const s = similarity(r.runnerName, targetName);
      if (!bestRunner || s > bestRunner.s) bestRunner = { r, s };
    }
    if (bestRunner && bestRunner.s >= 0.6) runner = bestRunner.r;
  }
  if (!runner) {
    return { ok: false, reason: `Não consegui mapear outcome "${input.outcome}" pros runners ${runners.map((r) => r.runnerName).join(", ")}` };
  }

  return {
    ok: true,
    marketId: best.market.marketId,
    selectionId: runner.selectionId,
    runnerName: runner.runnerName,
    marketName: best.market.marketName,
    eventName: best.market.event?.name ?? "",
    eventStartTime: best.market.marketStartTime,
  };
}

// =============================================================================
// Place bet — orchestrates find market → check price → place order → persist
// =============================================================================

export type PlaceBetForSignalInput = {
  userId: number;
  decisionId?: number;
  adviceId?: number;
  home: string;
  away: string;
  market: string;
  outcome: string;
  bestPrice: number;
  stake: number;
  commence?: string;
  source?: "manual" | "betfair_auto" | "betfair_oneClick";
  priceTolerancePct?: number;  // default 5% — abort if live price < recommended × (1 - tol)
};

export type PlaceBetForSignalResult =
  | { ok: true; betId: number; betfairBetId?: string; matchedPrice: number; matchedSize: number; runnerName: string; status: string }
  | { ok: false; reason: string; persistedBetId?: number };

export async function placeBetForSignal(input: PlaceBetForSignalInput): Promise<PlaceBetForSignalResult> {
  const creds = await loadBetfairCreds(input.userId);
  if (!creds) return { ok: false, reason: "Betfair não conectada. Configure em /integrations." };

  // 1. Pre-flight: confirm we have funds before burning API calls.
  let funds;
  try {
    funds = await fetchBetfairFunds(creds);
  } catch (e) {
    return { ok: false, reason: `Falha ao ler saldo Betfair: ${e instanceof Error ? e.message : e}` };
  }
  if (funds.availableToBetBalance < input.stake) {
    return { ok: false, reason: `Saldo insuficiente na Betfair: R$ ${funds.availableToBetBalance.toFixed(2)} disponível, R$ ${input.stake.toFixed(2)} necessário.` };
  }

  // 2. Find the market + selection.
  const matched = await findMarketForSignal(creds, input);
  if (!matched.ok) return { ok: false, reason: matched.reason };

  // 3. Check live price vs recommended (avoid placing if odd dropped sharply).
  const book = await listMarketBook(creds, matched.marketId).catch(() => null);
  let livePrice: number | null = null;
  if (book && book.status === "OPEN") {
    const runner = book.runners.find((r) => r.selectionId === matched.selectionId);
    if (runner && runner.ex?.availableToBack && runner.ex.availableToBack.length > 0) {
      livePrice = runner.ex.availableToBack[0].price;
    }
  } else if (book && book.status !== "OPEN") {
    return { ok: false, reason: `Mercado Betfair não está aberto (status: ${book.status}).` };
  }
  const tolerancePct = input.priceTolerancePct ?? 5;
  if (livePrice != null) {
    const minAcceptable = input.bestPrice * (1 - tolerancePct / 100);
    if (livePrice < minAcceptable) {
      return { ok: false, reason: `Preço caiu demais: recomendado ${input.bestPrice.toFixed(2)}, agora ${livePrice.toFixed(2)} (queda ${((1 - livePrice / input.bestPrice) * 100).toFixed(1)}%). Limite ${tolerancePct}%.` };
    }
  }

  // 4. Persist pending bet row (so we have something to update if anything
  // below this point fails).
  const db = await getDb();
  if (!db) return { ok: false, reason: "Banco indisponível." };
  const customerRef = `bt-${input.decisionId ?? Date.now()}-${Math.floor(Math.random() * 1e6)}`.slice(0, 32);
  const eventLabel = `${input.home} × ${input.away}`;
  const insertResult = await db.insert(bets).values({
    userId: input.userId,
    decisionId: input.decisionId ?? null,
    adviceId: input.adviceId ?? null,
    event: eventLabel,
    market: input.market,
    outcome: input.outcome,
    side: "BACK",
    bookmaker: "Betfair",
    price: input.bestPrice.toString(),
    stake: input.stake.toString(),
    betfairMarketId: matched.marketId,
    betfairSelectionId: String(matched.selectionId),
    status: "pending",
    source: input.source ?? "manual",
  });
  const persistedBetId = (insertResult as any)?.[0]?.insertId ?? (insertResult as any)?.insertId ?? 0;

  // 5. Place the actual order.
  let result: PlaceBetResult;
  try {
    result = await placeBet(creds, {
      marketId: matched.marketId,
      selectionId: matched.selectionId,
      side: "BACK",
      price: livePrice ?? input.bestPrice,
      size: input.stake,
      customerRef,
    });
  } catch (e) {
    await db.update(bets).set({ status: "error", errorMessage: `placeBet falhou: ${e instanceof Error ? e.message : e}` })
      .where(eq(bets.id, persistedBetId));
    return { ok: false, reason: `placeBet falhou: ${e instanceof Error ? e.message : e}`, persistedBetId };
  }

  if (result.status !== "SUCCESS" || !result.betId) {
    await db.update(bets).set({
      status: "error",
      errorMessage: `Betfair rejeitou: ${result.status}${result.errorCode ? " — " + result.errorCode : ""}`,
    }).where(eq(bets.id, persistedBetId));
    return { ok: false, reason: `Betfair rejeitou: ${result.status}${result.errorCode ? " — " + result.errorCode : ""}`, persistedBetId };
  }

  // 6. Update the row with Betfair confirmation.
  await db.update(bets).set({
    status: "placed",
    betfairBetId: result.betId,
    averagePriceMatched: result.averagePriceMatched != null ? result.averagePriceMatched.toString() : null,
    sizeMatched: result.sizeMatched != null ? result.sizeMatched.toString() : null,
  }).where(eq(bets.id, persistedBetId));

  return {
    ok: true,
    betId: persistedBetId,
    betfairBetId: result.betId,
    matchedPrice: result.averagePriceMatched ?? input.bestPrice,
    matchedSize: result.sizeMatched ?? input.stake,
    runnerName: matched.runnerName,
    status: result.status,
  };
}

// =============================================================================
// Settlement — sync settled bets from Betfair and resolve brain_decisions
// =============================================================================

export async function settleBetfairBetsForUser(userId: number): Promise<{ settled: number; errors: number }> {
  const creds = await loadBetfairCreds(userId);
  if (!creds) return { settled: 0, errors: 0 };
  const db = await getDb();
  if (!db) return { settled: 0, errors: 0 };

  // Pull settled orders from the last 14 days. Match by betfairBetId.
  let cleared;
  try {
    cleared = await listClearedOrders(creds);
  } catch (e) {
    console.warn(`[betfairExecutor] listClearedOrders failed for user ${userId}:`, e instanceof Error ? e.message : e);
    return { settled: 0, errors: 1 };
  }

  let settled = 0;
  for (const o of cleared) {
    const row = await db.select().from(bets).where(and(eq(bets.userId, userId), eq(bets.betfairBetId, o.betId))).limit(1);
    if (row.length === 0) continue;
    const current = row[0];
    if (current.status === "won" || current.status === "lost" || current.status === "void") continue; // already settled
    let newStatus: "won" | "lost" | "void" = "void";
    if (o.betOutcome === "WON") newStatus = "won";
    else if (o.betOutcome === "LOST") newStatus = "lost";
    const profit = o.profit ?? 0;
    await db.update(bets).set({
      status: newStatus,
      profit: profit.toString(),
      settledAt: o.settledDate ? new Date(o.settledDate) : new Date(),
      averagePriceMatched: o.priceMatched != null ? o.priceMatched.toString() : current.averagePriceMatched,
      sizeMatched: o.sizeSettled != null ? o.sizeSettled.toString() : current.sizeMatched,
    }).where(eq(bets.id, current.id));
    // Also mirror to brain_decisions so /signals UI reflects the real money outcome.
    if (current.decisionId) {
      await db.update(brainDecisions).set({
        outcome: newStatus === "won" ? "profit" : newStatus === "lost" ? "loss" : "neutral",
        profitAmount: Math.abs(profit).toString(),
      }).where(eq(brainDecisions.id, current.decisionId));
    }
    settled++;
  }
  return { settled, errors: 0 };
}

// =============================================================================
// Auto-bet pipeline — called by oracle.ts after each scan
// =============================================================================

export async function isAutoBetEnabled(): Promise<boolean> {
  const v = await getAppSetting("BETFAIR_AUTO_BET_ENABLED");
  return v != null && v.toLowerCase() === "true";
}

export async function getAutoBetMaxStakeBrl(): Promise<number> {
  const v = await getAppSetting("BETFAIR_AUTO_BET_MAX_STAKE_BRL");
  const n = v ? parseFloat(v) : 10;
  return Number.isFinite(n) ? Math.max(0, Math.min(10000, n)) : 10;
}

export async function setAutoBetConfig(enabled?: boolean, maxStake?: number) {
  if (enabled != null) await setAppSetting("BETFAIR_AUTO_BET_ENABLED", enabled ? "true" : "false");
  if (maxStake != null) await setAppSetting("BETFAIR_AUTO_BET_MAX_STAKE_BRL", String(maxStake));
}
