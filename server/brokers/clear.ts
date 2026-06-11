// Clear Smart Trader API connector (skeleton).
//
// What you need to fill in to make this fully functional:
//   1. The exact REST endpoints from devs.clear.com.br (auth, orders,
//      positions, market data). The skeleton uses the documented general
//      shape (Bearer token + JSON), but the paths/payload formats need
//      to be confirmed against the live docs.
//   2. Credentials: typically clientId + clientSecret (OAuth2 client
//      credentials flow) issued after Clear approves your developer
//      application.
//
// This skeleton:
//   - Reads creds from broker_connections (broker="clear")
//   - Caches the OAuth bearer token in memory with TTL
//   - Implements the full BrokerConnector interface
//   - Throws clear errors so the OMS can record exactly what failed
//
// To activate:
//   - In /integrations → Clear: connect (clientId, clientSecret, account)
//   - Toggle "Routing broker = Clear" in the OMS config

import type { BrokerConnector, OrderRequest, OrderResponse, Position, AccountSnapshot, Asset, OrderStatus } from "./types";
import { getDb } from "../db";
import { brokerConnections } from "../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";

// TODO: confirm these against the live Clear documentation.
const BASE_AUTH = process.env.CLEAR_AUTH_BASE || "https://api.clear.com.br/oauth/v1";
const BASE_API = process.env.CLEAR_API_BASE || "https://api.clear.com.br/smart-trader/v1";

type ClearCreds = {
  clientId: string;
  clientSecret: string;
  account?: string;     // Clear account number
};

type CachedToken = { token: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

async function loadCreds(): Promise<ClearCreds | null> {
  const db = await getDb();
  if (!db) return null;
  // Single global Clear connection for now (admin-level setup); when we
  // support multi-user broker accounts we'll scope this by userId.
  const rows = await db.select().from(brokerConnections).where(eq(brokerConnections.broker, "clear")).limit(1);
  if (rows.length === 0) return null;
  try {
    const raw = rows[0].credentials;
    if (!raw) return null;
    const parsed = JSON.parse(decryptSecret(raw));
    if (!parsed.clientId || !parsed.clientSecret) return null;
    return parsed as ClearCreds;
  } catch {
    return null;
  }
}

async function getToken(creds: ClearCreds): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: "trading market-data positions",
  }).toString();
  const resp = await fetch(`${BASE_AUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Clear OAuth ${resp.status}: ${text.slice(0, 200)}`);
  }
  const j = await resp.json() as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("Clear OAuth: token vazio");
  tokenCache = { token: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

async function rpc<T>(path: string, init?: RequestInit): Promise<T> {
  const creds = await loadCreds();
  if (!creds) throw new Error("Clear não configurada. Conecte em /integrations.");
  const token = await getToken(creds);
  const resp = await fetch(`${BASE_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
      ...(creds.account ? { "X-Account": creds.account } : {}),
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 401) tokenCache = null;
    throw new Error(`Clear ${path} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

function mapStatus(clear: string | undefined): OrderStatus {
  switch ((clear || "").toUpperCase()) {
    case "NEW":
    case "PENDING_NEW":
      return "SUBMITTED";
    case "PARTIALLY_FILLED":
      return "PARTIALLY_FILLED";
    case "FILLED":
      return "FILLED";
    case "CANCELED":
    case "CANCELLED":
      return "CANCELLED";
    case "REJECTED":
      return "REJECTED";
    case "EXPIRED":
      return "EXPIRED";
    default:
      return "SUBMITTED";
  }
}

export const clearConnector: BrokerConnector = {
  name: "Clear",
  market: "B3",

  async isConfigured() {
    return (await loadCreds()) != null;
  },

  async testConnection() {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "Sem credenciais Clear configuradas." };
    try {
      await getToken(creds);
      return { ok: true, message: "Token Clear obtido com sucesso." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },

  async getAccount(): Promise<AccountSnapshot> {
    // Endpoint shape: /accounts/{account}/snapshot — confirm against docs.
    const r = await rpc<{ cashAvailable: number; totalEquity: number; positions?: any[] }>("/account/snapshot");
    const positions: Position[] = (r.positions ?? []).map((p) => ({
      asset: { symbol: p.symbol, market: "B3" },
      quantity: Number(p.quantity ?? 0),
      averageEntryPrice: Number(p.averagePrice ?? 0),
      marketValue: p.marketValue != null ? Number(p.marketValue) : undefined,
      unrealizedPnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : undefined,
    }));
    return {
      cashAvailable: Number(r.cashAvailable ?? 0),
      totalEquity: Number(r.totalEquity ?? 0),
      currency: "BRL",
      positions,
    };
  },

  async getPositions() {
    const snap = await this.getAccount();
    return snap.positions;
  },

  async getOrder(brokerOrderId: string): Promise<OrderResponse | null> {
    try {
      const o = await rpc<any>(`/orders/${encodeURIComponent(brokerOrderId)}`);
      return {
        brokerOrderId: o.id ?? brokerOrderId,
        status: mapStatus(o.status),
        asset: { symbol: o.symbol, market: "B3" },
        side: o.side === "SELL" ? "SELL" : "BUY",
        quantity: Number(o.quantity ?? 0),
        filledQuantity: Number(o.filledQuantity ?? 0),
        averagePrice: o.averagePrice != null ? Number(o.averagePrice) : undefined,
        message: o.message,
        placedAt: o.placedAt ?? new Date().toISOString(),
      };
    } catch (e) {
      if (e instanceof Error && /404/.test(e.message)) return null;
      throw e;
    }
  },

  async listOpenOrders(): Promise<OrderResponse[]> {
    const r = await rpc<{ orders: any[] }>("/orders/open");
    return (r.orders ?? []).map((o) => ({
      brokerOrderId: o.id,
      status: mapStatus(o.status),
      asset: { symbol: o.symbol, market: "B3" },
      side: o.side === "SELL" ? "SELL" : "BUY",
      quantity: Number(o.quantity ?? 0),
      filledQuantity: Number(o.filledQuantity ?? 0),
      averagePrice: o.averagePrice != null ? Number(o.averagePrice) : undefined,
      placedAt: o.placedAt ?? new Date().toISOString(),
    }));
  },

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    // Endpoint shape: POST /orders — confirm against docs. The payload uses
    // the names most commonly seen in retail B3 APIs.
    const payload: Record<string, unknown> = {
      symbol: req.asset.symbol,
      side: req.side,
      orderType: req.orderType,
      quantity: req.quantity,
      timeInForce: req.timeInForce ?? "DAY",
      ...(req.limitPrice != null ? { limitPrice: req.limitPrice } : {}),
      ...(req.stopPrice != null ? { stopPrice: req.stopPrice } : {}),
      ...(req.clientOrderId ? { clientOrderId: req.clientOrderId } : {}),
    };
    const r = await rpc<any>("/orders", { method: "POST", body: JSON.stringify(payload) });
    return {
      brokerOrderId: r.id ?? r.orderId ?? r.clientOrderId,
      status: mapStatus(r.status),
      asset: req.asset,
      side: req.side,
      quantity: req.quantity,
      filledQuantity: Number(r.filledQuantity ?? 0),
      averagePrice: r.averagePrice != null ? Number(r.averagePrice) : undefined,
      message: r.message,
      placedAt: r.placedAt ?? new Date().toISOString(),
    };
  },

  async cancelOrder(brokerOrderId: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await rpc(`/orders/${encodeURIComponent(brokerOrderId)}/cancel`, { method: "POST" });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
};

// Helper for outside callers to read where the connector points (for UI
// diagnostics): which env vars override the base URLs.
export function clearEnvironment() {
  return {
    authBase: BASE_AUTH,
    apiBase: BASE_API,
    authOverridden: !!process.env.CLEAR_AUTH_BASE,
    apiOverridden: !!process.env.CLEAR_API_BASE,
  };
}

// Suppress unused TypeScript warning for Asset
type _Asset = Asset;
