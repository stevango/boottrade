import type { PricePoint } from "./signals";
import { getAppSetting } from "./db";

// Pluggable market-data feed. Uses brapi.dev (BR assets, free tier) when a
// token is configured (env var or admin-managed app setting).

export class MarketDataNotConfiguredError extends Error {
  constructor() {
    super("Market data feed not configured");
    this.name = "MarketDataNotConfiguredError";
  }
}

async function getBrapiToken(): Promise<string | null> {
  return process.env.BRAPI_TOKEN || (await getAppSetting("BRAPI_TOKEN"));
}

export async function isMarketDataConfigured(): Promise<boolean> {
  return (await getBrapiToken()) !== null;
}

// Lightweight verification: fetch a known symbol (PETR4).
export async function testMarketDataConnection(): Promise<{ ok: boolean; message: string }> {
  const token = await getBrapiToken();
  if (!token) return { ok: false, message: "Nenhum BRAPI_TOKEN configurado (env ou UI)." };
  try {
    const resp = await fetch(`https://brapi.dev/api/quote/PETR4?token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return { ok: false, message: `${resp.status} ${resp.statusText}` };
    const data = await resp.json().catch(() => ({})) as { results?: unknown[] };
    return { ok: Array.isArray(data.results) && data.results.length > 0, message: "Conectado: cotação PETR4 recebida" };
  } catch (e) {
    return { ok: false, message: String(e).slice(0, 200) };
  }
}

type BrapiResult = {
  results?: {
    symbol?: string;
    longName?: string;
    shortName?: string;
    regularMarketPrice?: number;
    historicalDataPrice?: { date: number; close: number }[];
  }[];
};

export type MarketHistory = {
  symbol: string;
  name: string;
  points: PricePoint[];
};

export async function fetchDailyHistory(symbol: string, range = "5y"): Promise<MarketHistory> {
  const token = await getBrapiToken();
  if (!token) throw new MarketDataNotConfiguredError();

  const clean = symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(clean)}?range=${encodeURIComponent(range)}&interval=1d&token=${encodeURIComponent(token)}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Market data ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as BrapiResult;
  const r = data.results?.[0];
  if (!r) throw new Error(`Nenhum dado encontrado para "${clean}".`);

  const points: PricePoint[] = (r.historicalDataPrice ?? [])
    .filter(p => Number.isFinite(p.close) && Number.isFinite(p.date))
    .map(p => ({ date: p.date * 1000, close: p.close }));

  return { symbol: r.symbol || clean, name: r.longName || r.shortName || clean, points };
}
