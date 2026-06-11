// Order Management System — the single place that turns "robot generated a
// signal" into "order routed to broker". Owns:
//   - Pre-trade risk checks (cash, exposure, daily limits, kill switch)
//   - Routing decision (paper vs clear vs off)
//   - Idempotency (don't double-submit the same signal)
//   - Persistence (write to bets table + brain_decisions)
//   - Audit log (every attempt, success/failure, reason)

import { eq, and } from "drizzle-orm";
import { getDb, getAppSetting, addBrainDecision } from "./db";
import { bets, brainDecisions } from "../drizzle/schema";
import { getActiveConnector, getRoutingMode } from "./brokers/registry";
import type { OrderRequest, OrderResponse } from "./brokers/types";

export type OmsTradeInput = {
  userId: number;
  decisionId?: number;          // brain_decisions row that triggered this
  symbol: string;
  side: "BUY" | "SELL";
  stake: number;                // BRL (we'll compute quantity from latest price)
  limitPrice?: number;
  source: "athena" | "oracle" | "manual" | "external";
  reasoning?: string;
};

export type OmsResult =
  | { ok: true; betId: number; brokerOrderId: string; status: string; filledQuantity: number; averagePrice?: number; route: string }
  | { ok: false; reason: string; betId?: number };

// =============================================================================
// Risk gates
// =============================================================================

async function getKillSwitch(): Promise<boolean> {
  return (await getAppSetting("OMS_KILL_SWITCH"))?.toLowerCase() === "true";
}

async function getDailyMaxStakeBrl(): Promise<number> {
  const v = await getAppSetting("OMS_DAILY_MAX_STAKE_BRL");
  const n = v ? parseFloat(v) : 500;
  return Number.isFinite(n) ? n : 500;
}

async function getMaxPerOrderBrl(): Promise<number> {
  const v = await getAppSetting("OMS_MAX_PER_ORDER_BRL");
  const n = v ? parseFloat(v) : 100;
  return Number.isFinite(n) ? n : 100;
}

async function sumTodayStakes(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db.select().from(bets).where(eq(bets.userId, userId));
  let total = 0;
  for (const r of rows) {
    if (!r.placedAt) continue;
    if (new Date(r.placedAt).getTime() < startOfDay.getTime()) continue;
    if (r.status === "error" || r.status === "cancelled") continue;
    total += parseFloat(String(r.stake || "0"));
  }
  return total;
}

// =============================================================================
// Idempotency — never submit the same signal twice
// =============================================================================

async function findExistingForDecision(decisionId: number): Promise<{ id: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: bets.id }).from(bets).where(eq(bets.decisionId, decisionId)).limit(1);
  return rows[0] ?? null;
}

// =============================================================================
// Main entrypoint
// =============================================================================

export async function executeSignal(input: OmsTradeInput): Promise<OmsResult> {
  // 1. Kill switch
  if (await getKillSwitch()) {
    return { ok: false, reason: "Kill-switch ativo. Ordem bloqueada antes de chegar no broker." };
  }

  // 2. Idempotency
  if (input.decisionId) {
    const existing = await findExistingForDecision(input.decisionId);
    if (existing) {
      return { ok: false, reason: `Decisão ${input.decisionId} já tem ordem registrada (bet ${existing.id})`, betId: existing.id };
    }
  }

  // 3. Per-order cap
  const perOrderCap = await getMaxPerOrderBrl();
  if (input.stake > perOrderCap) {
    return { ok: false, reason: `Stake R$ ${input.stake.toFixed(2)} excede limite por ordem R$ ${perOrderCap.toFixed(2)}` };
  }

  // 4. Daily cap
  const dailyCap = await getDailyMaxStakeBrl();
  const usedToday = await sumTodayStakes(input.userId);
  if (usedToday + input.stake > dailyCap) {
    return { ok: false, reason: `Limite diário estouraria: R$ ${usedToday.toFixed(2)} já apostado hoje + R$ ${input.stake.toFixed(2)} = R$ ${(usedToday + input.stake).toFixed(2)} (cap R$ ${dailyCap.toFixed(2)})` };
  }

  // 5. Get the active connector
  const connector = await getActiveConnector();
  const route = await getRoutingMode();
  if (!connector || route === "off") {
    return { ok: false, reason: "Roteamento de ordens desligado. Configure em /integrations → Roteamento." };
  }

  // 6. Translate stake (BRL) → quantity (shares)
  let quantity: number;
  let referencePrice: number;
  try {
    const acc = await connector.getAccount();
    if (acc.cashAvailable < input.stake) {
      return { ok: false, reason: `Saldo insuficiente no broker ${connector.name}: R$ ${acc.cashAvailable.toFixed(2)} disponível.` };
    }
    // Reference price: use connector positions if held, else fetch via brapi.
    const { fetchDailyHistory } = await import("./marketData");
    const hist = await fetchDailyHistory(input.symbol, "1mo");
    if (!hist.points || hist.points.length === 0) {
      return { ok: false, reason: `Sem cotação pra ${input.symbol}` };
    }
    referencePrice = hist.points[hist.points.length - 1].close;
    if (referencePrice <= 0) return { ok: false, reason: `Cotação inválida pra ${input.symbol}` };
    quantity = Math.floor(input.stake / referencePrice);
    if (quantity <= 0) return { ok: false, reason: `Stake R$ ${input.stake.toFixed(2)} não compra nem 1 lote de ${input.symbol} a R$ ${referencePrice.toFixed(2)}` };
  } catch (e) {
    return { ok: false, reason: `Falha ao calcular quantidade: ${e instanceof Error ? e.message : e}` };
  }

  // 7. Persist pending bet so we have a row to update if anything below fails
  const db = await getDb();
  if (!db) return { ok: false, reason: "Banco indisponível" };
  const clientOrderId = `oms-${input.decisionId ?? Date.now()}-${Math.floor(Math.random() * 1e6)}`.slice(0, 32);
  const inserted = await db.insert(bets).values({
    userId: input.userId,
    decisionId: input.decisionId ?? null,
    event: input.symbol,
    market: "stock",
    outcome: input.side,
    side: "BACK",
    bookmaker: connector.name,
    price: referencePrice.toString(),
    stake: input.stake.toString(),
    status: "pending",
    source: input.source === "athena" || input.source === "oracle" ? "betfair_auto" : "manual",
  });
  const betId = (inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId ?? 0;

  // 8. Send to broker
  const req: OrderRequest = {
    asset: { symbol: input.symbol, market: "B3" },
    side: input.side,
    quantity,
    orderType: input.limitPrice != null ? "LIMIT" : "MARKET",
    limitPrice: input.limitPrice,
    timeInForce: "DAY",
    clientOrderId,
  };
  let resp: OrderResponse;
  try {
    resp = await connector.placeOrder(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(bets).set({ status: "error", errorMessage: msg }).where(eq(bets.id, betId));
    return { ok: false, reason: `Broker ${connector.name} rejeitou: ${msg}`, betId };
  }

  // 9. Update row with broker response
  const newStatus =
    resp.status === "FILLED" ? "placed" :
    resp.status === "REJECTED" ? "error" :
    resp.status === "CANCELLED" ? "cancelled" :
    "placed";
  await db.update(bets).set({
    status: newStatus,
    betfairBetId: resp.brokerOrderId,
    averagePriceMatched: resp.averagePrice != null ? resp.averagePrice.toString() : null,
    sizeMatched: resp.filledQuantity != null ? (resp.filledQuantity * (resp.averagePrice ?? referencePrice)).toString() : null,
    errorMessage: resp.status === "REJECTED" ? resp.message : null,
  }).where(eq(bets.id, betId));

  if (resp.status === "REJECTED") {
    return { ok: false, reason: resp.message || "Broker rejeitou a ordem", betId };
  }

  return {
    ok: true,
    betId,
    brokerOrderId: resp.brokerOrderId,
    status: resp.status,
    filledQuantity: resp.filledQuantity,
    averagePrice: resp.averagePrice,
    route: connector.name,
  };
}

// =============================================================================
// Read APIs for the UI
// =============================================================================

export async function getOmsConfig() {
  return {
    routingMode: await getRoutingMode(),
    killSwitch: await getKillSwitch(),
    dailyMaxStakeBrl: await getDailyMaxStakeBrl(),
    maxPerOrderBrl: await getMaxPerOrderBrl(),
  };
}

export async function setOmsConfig(input: { routingMode?: string; killSwitch?: boolean; dailyMaxStakeBrl?: number; maxPerOrderBrl?: number }) {
  const { setAppSetting: set } = await import("./db");
  if (input.routingMode != null) await set("ROUTING_MODE", input.routingMode);
  if (input.killSwitch != null) await set("OMS_KILL_SWITCH", input.killSwitch ? "true" : "false");
  if (input.dailyMaxStakeBrl != null) await set("OMS_DAILY_MAX_STAKE_BRL", String(input.dailyMaxStakeBrl));
  if (input.maxPerOrderBrl != null) await set("OMS_MAX_PER_ORDER_BRL", String(input.maxPerOrderBrl));
}
