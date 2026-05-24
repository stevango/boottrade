import { createHmac } from "crypto";

// Read-only Binance Spot account sync. Uses the user's API key/secret to fetch
// balances via a signed request. No trading endpoints are ever called.
export type BinanceBalance = { asset: string; free: string; locked: string };

export async function fetchBinanceBalances(apiKey: string, apiSecret: string): Promise<BinanceBalance[]> {
  const query = `recvWindow=5000&timestamp=${Date.now()}`;
  const signature = createHmac("sha256", apiSecret).update(query).digest("hex");
  const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;

  const resp = await fetch(url, {
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Binance API ${resp.status}: ${text.slice(0, 200)}`);
  }

  const data = (await resp.json()) as { balances?: BinanceBalance[] };
  return (data.balances ?? []).filter(
    (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0,
  );
}
