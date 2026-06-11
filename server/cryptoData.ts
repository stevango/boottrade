// Public crypto market data (Mercado Bitcoin tickers — no auth needed). Used
// by the Kraken AI robot to generate crypto signals without burning the
// authenticated MB API quota.

const MB_TICKERS_URL = "https://api.mercadobitcoin.net/api/v4/tickers";
const MB_CANDLES_URL = "https://api.mercadobitcoin.net/api/v4/candles";

export type CryptoTicker = {
  symbol: string;
  last: number;
  high: number;
  low: number;
  volume: number;
  buy: number;
  sell: number;
};

export async function fetchCryptoTickers(symbols: string[]): Promise<CryptoTicker[]> {
  const list = symbols.map((s) => s.toUpperCase()).join(",");
  const resp = await fetch(`${MB_TICKERS_URL}?symbols=${encodeURIComponent(list)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`MB tickers ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as any[];
  return (data ?? []).map((t) => ({
    symbol: t.pair ?? t.symbol,
    last: parseFloat(t.last ?? "0"),
    high: parseFloat(t.high ?? "0"),
    low: parseFloat(t.low ?? "0"),
    volume: parseFloat(t.vol ?? "0"),
    buy: parseFloat(t.buy ?? "0"),
    sell: parseFloat(t.sell ?? "0"),
  }));
}

export type CryptoCandle = { timestamp: number; open: number; close: number; high: number; low: number; volume: number };

// MB candles: ?symbol=BTC-BRL&resolution=1d&countback=N
export async function fetchCryptoCandles(symbol: string, resolution: "1d" | "60" | "240" = "1d", countback = 60): Promise<CryptoCandle[]> {
  const params = new URLSearchParams({
    symbol: symbol.replace(/BRL$/, "-BRL"),
    resolution,
    countback: String(countback),
    to: String(Math.floor(Date.now() / 1000)),
  });
  const resp = await fetch(`${MB_CANDLES_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`MB candles ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json() as { t?: number[]; o?: string[]; c?: string[]; h?: string[]; l?: string[]; v?: string[] };
  const out: CryptoCandle[] = [];
  if (Array.isArray(data.t)) {
    for (let i = 0; i < data.t.length; i++) {
      out.push({
        timestamp: data.t[i] * 1000,
        open: parseFloat(data.o?.[i] ?? "0"),
        close: parseFloat(data.c?.[i] ?? "0"),
        high: parseFloat(data.h?.[i] ?? "0"),
        low: parseFloat(data.l?.[i] ?? "0"),
        volume: parseFloat(data.v?.[i] ?? "0"),
      });
    }
  }
  return out;
}
