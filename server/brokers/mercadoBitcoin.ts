// Mercado Bitcoin connector — crypto BRL via Mercado Bitcoin v4 API.
//
// Docs: https://api.mercadobitcoin.net/api/v4/docs
// Auth: API key + secret, HMAC-SHA256 signature per request.
// Endpoints we use:
//   GET  /accounts/{accountId}/balances     — wallet balances
//   GET  /accounts/{accountId}/positions    — positions
//   POST /accounts/{accountId}/orders       — place order
//   GET  /accounts/{accountId}/orders       — list orders
//   POST /accounts/{accountId}/orders/{id}/cancel

import crypto from "node:crypto";
import type { BrokerConnector, OrderRequest, OrderResponse, Position, AccountSnapshot, OrderStatus } from "./types";
import { getDb } from "../db";
import { brokerConnections } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "../crypto";

const BASE = "https://api.mercadobitcoin.net/api/v4";

type MbCreds = {
  apiKey: string;
  apiSecret: string;
  accountId: string;
};

async function loadCreds(): Promise<MbCreds | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(brokerConnections).where(eq(brokerConnections.broker, "mercado_bitcoin")).limit(1);
  if (rows.length === 0) return null;
  try {
    const raw = rows[0].credentials;
    if (!raw) return null;
    const parsed = JSON.parse(decryptSecret(raw));
    if (!parsed.apiKey || !parsed.apiSecret || !parsed.accountId) return null;
    return parsed as MbCreds;
  } catch {
    return null;
  }
}

async function signedFetch<T>(creds: MbCreds, method: string, path: string, body?: unknown): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const message = `${timestamp}${method}${path}${bodyStr}`;
  const signature = crypto.createHmac("sha256", creds.apiSecret).update(message).digest("hex");
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-MB-API-KEY": creds.apiKey,
      "X-MB-API-SIGNATURE": signature,
      "X-MB-TIMESTAMP": timestamp,
    },
    body: bodyStr || undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Mercado Bitcoin ${path} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json() as Promise<T>;
}

function mapStatus(mb: string | undefined): OrderStatus {
  switch ((mb || "").toLowerCase()) {
    case "filled": return "FILLED";
    case "partially_filled": return "PARTIALLY_FILLED";
    case "cancelled": return "CANCELLED";
    case "rejected": return "REJECTED";
    case "open":
    case "active":
    case "pending":
      return "SUBMITTED";
    default: return "SUBMITTED";
  }
}

export const mercadoBitcoinConnector: BrokerConnector = {
  name: "MercadoBitcoin",
  market: "CRYPTO",

  async isConfigured() {
    return (await loadCreds()) != null;
  },

  async testConnection() {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "Sem credenciais Mercado Bitcoin." };
    try {
      const balances = await signedFetch<any[]>(creds, "GET", `/accounts/${creds.accountId}/balances`);
      const brl = balances.find((b: any) => b.symbol === "BRL");
      return { ok: true, message: `BRL disponível: R$ ${parseFloat(brl?.available ?? "0").toFixed(2)}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },

  async getAccount(): Promise<AccountSnapshot> {
    const creds = await loadCreds();
    if (!creds) throw new Error("Mercado Bitcoin não configurada");
    const balances = await signedFetch<any[]>(creds, "GET", `/accounts/${creds.accountId}/balances`);
    const brl = balances.find((b: any) => b.symbol === "BRL");
    const cashAvailable = parseFloat(brl?.available ?? "0");
    let totalEquity = cashAvailable;
    const positions: Position[] = [];
    for (const b of balances) {
      if (b.symbol === "BRL") continue;
      const qty = parseFloat(b.available ?? "0") + parseFloat(b.on_hold ?? "0");
      if (qty <= 0) continue;
      // Skip mkt value calc — Mercado Bitcoin separately exposes /tickers if needed.
      positions.push({
        asset: { symbol: `${b.symbol}BRL`, market: "CRYPTO" },
        quantity: qty,
        averageEntryPrice: 0,
      });
    }
    return { cashAvailable, totalEquity, currency: "BRL", positions };
  },

  async getPositions() {
    const snap = await this.getAccount();
    return snap.positions;
  },

  async getOrder(brokerOrderId: string): Promise<OrderResponse | null> {
    const creds = await loadCreds();
    if (!creds) return null;
    try {
      const o = await signedFetch<any>(creds, "GET", `/accounts/${creds.accountId}/orders/${brokerOrderId}`);
      return {
        brokerOrderId,
        status: mapStatus(o.status),
        asset: { symbol: o.symbol, market: "CRYPTO" },
        side: (o.side || "").toUpperCase() === "SELL" ? "SELL" : "BUY",
        quantity: parseFloat(o.quantity ?? "0"),
        filledQuantity: parseFloat(o.filled_quantity ?? "0"),
        averagePrice: o.avg_price != null ? parseFloat(o.avg_price) : undefined,
        placedAt: o.created_at ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async listOpenOrders(): Promise<OrderResponse[]> {
    const creds = await loadCreds();
    if (!creds) return [];
    try {
      const orders = await signedFetch<any[]>(creds, "GET", `/accounts/${creds.accountId}/orders?status=active`);
      return (orders ?? []).map((o) => ({
        brokerOrderId: String(o.id),
        status: mapStatus(o.status),
        asset: { symbol: o.symbol, market: "CRYPTO" },
        side: (o.side || "").toUpperCase() === "SELL" ? "SELL" : "BUY",
        quantity: parseFloat(o.quantity ?? "0"),
        filledQuantity: parseFloat(o.filled_quantity ?? "0"),
        averagePrice: o.avg_price != null ? parseFloat(o.avg_price) : undefined,
        placedAt: o.created_at ?? new Date().toISOString(),
      }));
    } catch {
      return [];
    }
  },

  async placeOrder(req: OrderRequest): Promise<OrderResponse> {
    const creds = await loadCreds();
    if (!creds) throw new Error("Mercado Bitcoin não configurada");
    const payload = {
      symbol: req.asset.symbol,
      side: req.side.toLowerCase(),
      type: req.orderType === "LIMIT" ? "limit" : "market",
      quantity: String(req.quantity),
      ...(req.limitPrice != null ? { limit_price: String(req.limitPrice) } : {}),
      ...(req.clientOrderId ? { external_id: req.clientOrderId } : {}),
    };
    const r = await signedFetch<any>(creds, "POST", `/accounts/${creds.accountId}/orders`, payload);
    return {
      brokerOrderId: String(r.id ?? r.order_id ?? ""),
      status: mapStatus(r.status),
      asset: req.asset,
      side: req.side,
      quantity: req.quantity,
      filledQuantity: parseFloat(r.filled_quantity ?? "0"),
      averagePrice: r.avg_price != null ? parseFloat(r.avg_price) : undefined,
      placedAt: r.created_at ?? new Date().toISOString(),
    };
  },

  async cancelOrder(brokerOrderId: string) {
    const creds = await loadCreds();
    if (!creds) return { ok: false, message: "Mercado Bitcoin não configurada" };
    try {
      await signedFetch(creds, "POST", `/accounts/${creds.accountId}/orders/${brokerOrderId}/cancel`);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  },
};
