import type { PricePoint } from "./signals";

// Pluggable market-data feed. Uses brapi.dev (BR assets, free tier) when a
// token is configured. Returns a clear "not configured" signal otherwise so
// the UI can guide setup instead of failing.

export class MarketDataNotConfiguredError extends Error {
  constructor() {
    super("Market data feed not configured");
    this.name = "MarketDataNotConfiguredError";
  }
}

export function isMarketDataConfigured(): boolean {
  return Boolean(process.env.BRAPI_TOKEN);
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
  const token = process.env.BRAPI_TOKEN;
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
