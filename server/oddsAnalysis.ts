// Shared value-bet analysis. Provider adapters normalize their raw response
// into NormalizedEvent and call computeValueBets. Keeps the math in one
// place and lets the scanner work with any odds feed.

export type NormalizedOutcome = { name: string; price: number; point?: number };
export type NormalizedMarket = { key: string; outcomes: NormalizedOutcome[] };
export type NormalizedBookmaker = { name: string; markets: NormalizedMarket[] };
export type NormalizedEvent = {
  id: string;
  commenceTime: string;
  home: string;
  away: string;
  bookmakers: NormalizedBookmaker[];
};

export type ValueBet = {
  event: string;
  commence: string;
  market: string;
  outcome: string;
  point?: number;
  bestBook: string;
  bestPrice: number;
  avgPrice: number;
  booksCount: number;
  edgePct: number;
};

type BetEntry = { book: string; price: number };
type BetBucket = { name: string; point?: number; market: string; entries: BetEntry[] };

export function computeValueBets(events: NormalizedEvent[], edgeThresholdPct = 3): ValueBet[] {
  const out: ValueBet[] = [];
  for (const ev of events) {
    const buckets = new Map<string, BetBucket>();
    for (const bm of ev.bookmakers ?? []) {
      for (const mk of bm.markets ?? []) {
        for (const oc of mk.outcomes ?? []) {
          if (!Number.isFinite(oc.price) || oc.price <= 1) continue;
          const k = `${mk.key}|${oc.name}|${oc.point ?? ""}`;
          let b = buckets.get(k);
          if (!b) { b = { name: oc.name, point: oc.point, market: mk.key, entries: [] }; buckets.set(k, b); }
          b.entries.push({ book: bm.name, price: oc.price });
        }
      }
    }
    for (const b of Array.from(buckets.values())) {
      if (b.entries.length < 2) continue;
      const prices: number[] = b.entries.map((e: BetEntry) => e.price);
      const avg = prices.reduce((a: number, p: number) => a + p, 0) / prices.length;
      const best = b.entries.reduce((a: BetEntry, c: BetEntry) => (c.price > a.price ? c : a));
      const edgePct = ((best.price / avg) - 1) * 100;
      if (edgePct >= edgeThresholdPct) {
        out.push({
          event: `${ev.home} × ${ev.away}`,
          commence: ev.commenceTime,
          market: b.market,
          outcome: b.name,
          point: b.point,
          bestBook: best.book,
          bestPrice: best.price,
          avgPrice: Math.round(avg * 1000) / 1000,
          booksCount: b.entries.length,
          edgePct: Math.round(edgePct * 10) / 10,
        });
      }
    }
  }
  out.sort((a, b) => b.edgePct - a.edgePct);
  return out;
}
