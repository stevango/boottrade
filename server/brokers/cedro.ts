// Cedro Technologies connector (skeleton).
//
// Cedro é uma roteadora de ordens usada pela Clear, XP, BTG e outras casas BR.
// Quando o trader autoriza "Cedro" na página de Autorização de Roteamento da
// Clear (/autorizacao-de-roteamento), a Clear permite que aplicativos externos
// envie ordens para a conta dele via API Cedro.
//
// Fluxo de uso:
//   1. Usuário cadastra em cedrotech.com e contrata o plano de roteamento
//   2. Cedro envia: username + password (ou API key) + softwareKey
//   3. Usuário ativa "Cedro" na Clear → Autorização de Roteamento
//   4. Aqui no Boot Trade: /integrations → Cedro → cola as credenciais
//   5. OMS roteia: routingMode = "cedro" → este conector
//
// API de fato (Cedro Crystal):
//   - Auth: POST {base}/sign-in com { user, password, softwareKey }
//   - Account: GET {base}/account
//   - Positions: GET {base}/positions
//   - Place order: POST {base}/orders
//   - Cancel: DELETE {base}/orders/{id}
//   - Get order: GET {base}/orders/{id}
//
// Os paths abaixo seguem essa estrutura documentada. Quando o usuário tiver
// as credenciais reais a gente confirma e ajusta se preciso.
//
// Para ativar:
//   - /integrations → Cedro → conectar (username, password, softwareKey, account)
//   - OMS → routingMode = "cedro"

import type { BrokerConnector, OrderRequest, OrderResponse, Position, AccountSnapshot, OrderStatus } from "./types";
import { getDb } from "../db";
import { brokerConnections } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";

const BASE_API = process.env.CEDRO_API_BASE || "https://webfeeder.cedrotech.com/services/negotiation";

type CedroCreds = {
  username: string;
  password: string;
  softwareKey: string;     // chave do aplicativo emitida pela Cedro
  account?: string;        // número da conta na corretora roteada (Clear, XP, etc.)
};

type CachedSession = { token: string; expiresAt: number };
let sessionCache: CachedSession | null = null;

async function loadCreds(): Promise<CedroCreds | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brokerConnections).where(eq(brokerConnections.broker, "cedro")).limit(1);
  if (rows.length === 0) return null;
  try {
    const raw = rows[0].credentials;
    if (!raw) return null;
    const parsed = JSON.parse(decryptSecret(raw));
    if (!parsed.username || !parsed.password || !parsed.softwareKey) return null;
    return parsed as CedroCreds;
  } catch {
    return null;
  }
}

async function getSession(creds: CedroCreds): Promise<string> {
  if (sessionCache && Date.now() < sessionCache.expiresAt - 60_000) return sessionCache.token;
  const resp = await fetch(`${BASE_API}/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({
      user: creds.username,
      password: creds.password,
      softwareKey: creds.softwareKey,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Cedro sign-in ${resp.status}: ${text.slice(0, 200)}`);
  }
  const j = await resp.json() as { token?: string; access_token?: string; expiresIn?: number };
  const token = j.token ?? j.access_token;
  if (!token) throw new Error("Cedro sign-in: token vazio");
  // Sessões Cedro tipicamente duram a sessão do pregão (8h). Cacheamos 6h por segurança.
  sessionCache = { token, expiresAt: Date.now() + (j.expiresIn ?? 6 * 3600) * 1000 };
  return token;
}

async function rpc<T>(path: string, init?: RequestInit): Promise<T> {
  const creds = await loadCreds();
  if (!creds) throw new Error("Cedro não configurada. Conecte em /integrations.");
  const token = await getSession(creds);
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
    if (resp.status === 401) sessionCache = null;
    throw new Error(`Cedro ${path} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

function mapStatus(cedro: string | undefined): OrderStatus {
  switch ((cedro || "").toUpperCase()) {
    case "NEW":
    case "PENDING":
    case "PENDING_NEW":
      return "SUBMITTED";
    case "PARTIALLY_FILLED":
    case "PARTIAL":
      return "PARTIALLY_FILLED";
    case "FILLED":
    case "EXECUTED":
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

// Cedro usa "C" pra Compra e "V" pra Venda no payload de ordens
function sideToCedro(side: "BUY" | "SELL"): "C" | "V" {
  return side === "BUY" ? "C" : "V";
}

function cedroToSide(s: string | undefined): "BUY" | "SELL" {
  return (s || "").toUpperCase() === "V" || (s || "").toUpperCase() === "SELL" ? "SELL" : "BUY";
}

function orderTypeToCedro(t: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT"): string {
  switch (t) {
    case "MARKET": return "M";
    case "LIMIT": return "L";
    case "STOP": return "S";
    case "STOP_LIMIT": return "SL";
  }
}

export const cedroConnector: BrokerConnector = {
  name: "Cedro",
  market: "B3",

  async isConfigured() {
    return (await loadCreds()) != null;
  },

  async testConnection() {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "Sem credenciais Cedro configuradas." };
    try {
      await getSession(creds);
      return { ok: true, message: "Sessão Cedro autenticada com sucesso." };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },

  async getAccount(): Promise<AccountSnapshot> {
    const r = await rpc<{ cashAvailable?: number; totalEquity?: number; positions?: any[] }>("/account");
    const positions: Position[] = (r.positions ?? []).map((p) => ({
      asset: { symbol: p.symbol ?? p.ticker, market: "B3" },
      quantity: Number(p.quantity ?? p.qty ?? 0),
      averageEntryPrice: Number(p.averagePrice ?? p.avgPrice ?? 0),
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
    try {
      const r = await rpc<{ positions: any[] }>("/positions");
      return (r.positions ?? []).map((p) => ({
        asset: { symbol: p.symbol ?? p.ticker, market: "B3" },
        quantity: Number(p.quantity ?? p.qty ?? 0),
        averageEntryPrice: Number(p.averagePrice ?? p.avgPrice ?? 0),
        marketValue: p.marketValue != null ? Number(p.marketValue) : undefined,
        unrealizedPnl: p.unrealizedPnl != null ? Number(p.unrealizedPnl) : undefined,
      }));
    } catch {
      const snap = await this.getAccount();
      return snap.positions;
    }
  },

  async getOrder(brokerOrderId: string): Promise<OrderResponse | null> {
    try {
      const o = await rpc<any>(`/orders/${encodeURIComponent(brokerOrderId)}`);
      return {
        brokerOrderId: String(o.id ?? brokerOrderId),
        status: mapStatus(o.status),
        asset: { symbol: o.symbol ?? o.ticker, market: "B3" },
        side: cedroToSide(o.side),
        quantity: Number(o.quantity ?? o.qty ?? 0),
        filledQuantity: Number(o.filledQuantity ?? o.executedQty ?? 0),
        averagePrice: o.averagePrice != null ? Number(o.averagePrice) : undefined,
        message: o.message,
        placedAt: o.placedAt ?? o.createdAt ?? new Date().toISOString(),
      };
    } catch (e) {
      if (e instanceof Error && /404/.test(e.message)) return null;
      throw e;
    }
  },

  async listOpenOrders(): Promise<OrderResponse[]> {
    const r = await rpc<{ orders: any[] }>("/orders?status=open");
    return (r.orders ?? []).map((o) => ({
      brokerOrderId: String(o.id),
      status: mapStatus(o.status),
      asset: { symbol: o.symbol ?? o.ticker, market: "B3" },
      side: cedroToSide(o.side),
      quantity: Number(o.quantity ?? o.qty ?? 0),
      filledQuantity: Number(o.filledQuantity ?? o.executedQty ?? 0),
      averagePrice: o.averagePrice != null ? Number(o.averagePrice) : undefined,
      placedAt: o.placedAt ?? o.createdAt ?? new Date().toISOString(),
    }));
  },

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    const payload: Record<string, unknown> = {
      symbol: req.asset.symbol,
      side: sideToCedro(req.side),
      type: orderTypeToCedro(req.orderType),
      quantity: req.quantity,
      timeInForce: req.timeInForce ?? "DAY",
      ...(req.limitPrice != null ? { price: req.limitPrice } : {}),
      ...(req.stopPrice != null ? { stopPrice: req.stopPrice } : {}),
      ...(req.clientOrderId ? { clientOrderId: req.clientOrderId } : {}),
    };
    const r = await rpc<any>("/orders", { method: "POST", body: JSON.stringify(payload) });
    return {
      brokerOrderId: String(r.id ?? r.orderId ?? r.clientOrderId ?? ""),
      status: mapStatus(r.status),
      asset: req.asset,
      side: req.side,
      quantity: req.quantity,
      filledQuantity: Number(r.filledQuantity ?? r.executedQty ?? 0),
      averagePrice: r.averagePrice != null ? Number(r.averagePrice) : undefined,
      message: r.message,
      placedAt: r.placedAt ?? r.createdAt ?? new Date().toISOString(),
    };
  },

  async cancelOrder(brokerOrderId: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await rpc(`/orders/${encodeURIComponent(brokerOrderId)}`, { method: "DELETE" });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
};

export function cedroEnvironment() {
  return {
    apiBase: BASE_API,
    apiOverridden: !!process.env.CEDRO_API_BASE,
  };
}
