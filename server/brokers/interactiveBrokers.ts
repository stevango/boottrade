// Interactive Brokers Client Portal API connector.
//
// IB has two API options:
//   1. TWS API (Python/Java/C++) — requires local TWS or IB Gateway running
//   2. Client Portal API (REST) — requires the user to authenticate via
//      a web flow once a day to get session cookies
//
// We use option 2 since it's HTTP-based and works server-side without a
// local Gateway. The user logs in at clientportal.gw.interactivebrokers.com
// once daily and copies the session token here (similar to a TOTP setup).
//
// For full unattended automation, IB Gateway must run on a server with
// auto-login. That's beyond MVP — Phase 1 = user provides session token
// daily; Phase 2 = headless gateway deployment.
//
// Endpoints used:
//   POST /iserver/auth/status              — confirm session is alive
//   GET  /portfolio/{accountId}/summary    — cash + equity
//   GET  /portfolio/{accountId}/positions  — positions
//   POST /iserver/account/{id}/orders      — place order
//   POST /iserver/account/{id}/order/{oid}/cancel — cancel
//   GET  /iserver/account/{id}/orders      — list orders

import type { BrokerConnector, OrderRequest, OrderResponse, Position, AccountSnapshot, OrderStatus } from "./types";
import { getDb } from "../db";
import { brokerConnections } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";

const BASE = process.env.IB_API_BASE || "https://api.ibkr.com/v1/portal";

type IbCreds = {
  accountId: string;          // e.g. "U1234567"
  sessionToken: string;       // session cookie from /iserver/auth/status
};

async function loadCreds(): Promise<IbCreds | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brokerConnections).where(eq(brokerConnections.broker, "ibkr")).limit(1);
  if (rows.length === 0) return null;
  try {
    const raw = rows[0].credentials;
    if (!raw) return null;
    const parsed = JSON.parse(decryptSecret(raw));
    if (!parsed.accountId || !parsed.sessionToken) return null;
    return parsed as IbCreds;
  } catch {
    return null;
  }
}

async function rpc<T>(path: string, init?: RequestInit): Promise<T> {
  const creds = await loadCreds();
  if (!creds) throw new Error("Interactive Brokers não configurada. Conecte em /integrations.");
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Cookie": `api=${creds.sessionToken}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "BootTrade/1.0",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`IB ${path} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

function mapStatus(ib: string | undefined): OrderStatus {
  const s = (ib || "").toLowerCase();
  if (s.includes("filled")) return "FILLED";
  if (s.includes("partial")) return "PARTIALLY_FILLED";
  if (s.includes("cancel")) return "CANCELLED";
  if (s.includes("reject")) return "REJECTED";
  if (s.includes("submit") || s.includes("presubmit")) return "SUBMITTED";
  return "SUBMITTED";
}

// IB requires a contractId (conid) to place orders — we look it up by symbol.
async function lookupConid(symbol: string): Promise<number | null> {
  try {
    const r = await rpc<any>(`/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`);
    if (Array.isArray(r) && r.length > 0 && r[0].conid) return Number(r[0].conid);
  } catch { /* fall through */ }
  return null;
}

export const ibkrConnector: BrokerConnector = {
  name: "InteractiveBrokers",
  market: "MULTI",

  async isConfigured() {
    return (await loadCreds()) != null;
  },

  async testConnection() {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "Sem credenciais IBKR." };
    try {
      const r = await rpc<{ authenticated?: boolean; connected?: boolean }>("/iserver/auth/status");
      if (r.authenticated && r.connected) return { ok: true, message: "IBKR conectada e autenticada." };
      return { ok: false, message: "Sessão IBKR expirada. Renove o token no portal." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },

  async getAccount(): Promise<AccountSnapshot> {
    const creds = await loadCreds();
    if (!creds) throw new Error("IBKR não configurada");
    const summary = await rpc<any>(`/portfolio/${encodeURIComponent(creds.accountId)}/summary`);
    const positions = await this.getPositions();
    return {
      cashAvailable: Number(summary?.availablefunds?.amount ?? summary?.cushion?.amount ?? 0),
      totalEquity: Number(summary?.netliquidation?.amount ?? 0),
      currency: summary?.netliquidation?.currency ?? "USD",
      positions,
    };
  },

  async getPositions(): Promise<Position[]> {
    const creds = await loadCreds();
    if (!creds) return [];
    try {
      const arr = await rpc<any[]>(`/portfolio/${encodeURIComponent(creds.accountId)}/positions/0`);
      return (arr ?? []).map((p) => ({
        asset: { symbol: p.contractDesc || p.ticker, market: "NASDAQ" },
        quantity: Number(p.position ?? 0),
        averageEntryPrice: Number(p.avgCost ?? p.avgPrice ?? 0),
        marketValue: p.mktValue != null ? Number(p.mktValue) : undefined,
        unrealizedPnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : undefined,
      }));
    } catch {
      return [];
    }
  },

  async getOrder(brokerOrderId: string): Promise<OrderResponse | null> {
    const creds = await loadCreds();
    if (!creds) return null;
    try {
      const list = await rpc<{ orders?: any[] }>(`/iserver/account/${encodeURIComponent(creds.accountId)}/orders`);
      const o = (list.orders ?? []).find((x) => String(x.orderId) === brokerOrderId);
      if (!o) return null;
      return {
        brokerOrderId,
        status: mapStatus(o.status),
        asset: { symbol: o.ticker, market: "NASDAQ" },
        side: o.side === "SELL" ? "SELL" : "BUY",
        quantity: Number(o.totalSize ?? 0),
        filledQuantity: Number(o.filledQuantity ?? 0),
        averagePrice: o.avgPrice != null ? Number(o.avgPrice) : undefined,
        placedAt: o.lastExecutionTime ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async listOpenOrders(): Promise<OrderResponse[]> {
    const creds = await loadCreds();
    if (!creds) return [];
    try {
      const list = await rpc<{ orders?: any[] }>(`/iserver/account/${encodeURIComponent(creds.accountId)}/orders`);
      return (list.orders ?? [])
        .filter((o) => !["Filled", "Cancelled"].includes(o.status))
        .map((o) => ({
          brokerOrderId: String(o.orderId),
          status: mapStatus(o.status),
          asset: { symbol: o.ticker, market: "NASDAQ" },
          side: o.side === "SELL" ? "SELL" : "BUY",
          quantity: Number(o.totalSize ?? 0),
          filledQuantity: Number(o.filledQuantity ?? 0),
          averagePrice: o.avgPrice != null ? Number(o.avgPrice) : undefined,
          placedAt: o.lastExecutionTime ?? new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  },

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    const creds = await loadCreds();
    if (!creds) throw new Error("IBKR não configurada");
    const conid = await lookupConid(req.asset.symbol);
    if (!conid) {
      return {
        brokerOrderId: "",
        status: "REJECTED",
        asset: req.asset, side: req.side, quantity: req.quantity, filledQuantity: 0,
        message: `IBKR não encontrou conid pra ${req.asset.symbol}`,
        placedAt: new Date().toISOString(),
      };
    }
    const payload = {
      orders: [{
        conid,
        orderType: req.orderType === "LIMIT" ? "LMT" : req.orderType === "MARKET" ? "MKT" : "LMT",
        side: req.side,
        quantity: req.quantity,
        tif: req.timeInForce ?? "DAY",
        ...(req.limitPrice != null ? { price: req.limitPrice } : {}),
        ...(req.clientOrderId ? { cOID: req.clientOrderId } : {}),
      }],
    };
    const r = await rpc<any>(`/iserver/account/${encodeURIComponent(creds.accountId)}/orders`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const first = Array.isArray(r) ? r[0] : r;
    return {
      brokerOrderId: String(first?.order_id || first?.id || ""),
      status: mapStatus(first?.order_status),
      asset: req.asset,
      side: req.side,
      quantity: req.quantity,
      filledQuantity: 0,
      message: first?.message,
      placedAt: new Date().toISOString(),
    };
  },

  async cancelOrder(brokerOrderId: string): Promise<{ ok: boolean; message?: string }> {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "IBKR não configurada" };
    try {
      await rpc(`/iserver/account/${encodeURIComponent(creds.accountId)}/order/${encodeURIComponent(brokerOrderId)}/cancel`, { method: "POST" });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
};
