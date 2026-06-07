import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Stub the API call by intercepting fetch — keeps tests offline.
const origFetch = globalThis.fetch;

beforeEach(() => {
  process.env.ODDS_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = origFetch;
  delete process.env.ODDS_API_KEY;
});

describe("fetchOpportunities — value-bet ranking", () => {
  it("flags an outcome where one book is notably above the average", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([
      {
        id: "1", sport_key: "soccer_brazil", commence_time: "2026-06-10T20:00:00Z",
        home_team: "Brasil", away_team: "Argentina",
        bookmakers: [
          { key: "a", title: "Casa A", last_update: "", markets: [{ key: "h2h", outcomes: [{ name: "Brasil", price: 2.00 }, { name: "Argentina", price: 3.50 }] }] },
          { key: "b", title: "Casa B", last_update: "", markets: [{ key: "h2h", outcomes: [{ name: "Brasil", price: 2.40 }, { name: "Argentina", price: 3.10 }] }] },
          { key: "c", title: "Casa C", last_update: "", markets: [{ key: "h2h", outcomes: [{ name: "Brasil", price: 2.05 }, { name: "Argentina", price: 3.40 }] }] },
        ],
      },
    ])) ) as any;
    const { fetchOpportunities } = await import("./oddsData");
    const r = await fetchOpportunities({ sport: "soccer_brazil", edgeThresholdPct: 3 });
    // Casa B (2.40) vs avg ((2.00+2.40+2.05)/3 = 2.15) → edge ≈ 11.6%
    const top = r.valueBets[0];
    expect(top.outcome).toBe("Brasil");
    expect(top.bestBook).toBe("Casa B");
    expect(top.edgePct).toBeGreaterThan(10);
  });

  it("ignores outcomes with fewer than 2 books and prices <= 1", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify([
      { id: "1", sport_key: "s", commence_time: "", home_team: "A", away_team: "B",
        bookmakers: [{ key: "a", title: "A", last_update: "", markets: [{ key: "h2h", outcomes: [{ name: "A", price: 0.5 }, { name: "B", price: 2.0 }] }] }] }
    ])) ) as any;
    const { fetchOpportunities } = await import("./oddsData");
    const r = await fetchOpportunities({ sport: "s" });
    expect(r.valueBets).toEqual([]);
  });

  it("rejects without ODDS_API_KEY", async () => {
    delete process.env.ODDS_API_KEY;
    const { fetchOpportunities, OddsNotConfiguredError } = await import("./oddsData");
    await expect(fetchOpportunities({ sport: "s" })).rejects.toThrow(OddsNotConfiguredError);
  });
});
