import { describe, expect, it } from "vitest";
import { runMonteCarloBacktest } from "./backtest";

describe("runMonteCarloBacktest", () => {
  it("is deterministic for a given seed", () => {
    const params = { initialCapital: 10000, numTrades: 100, winRate: 55, payoffRatio: 1.5, riskPerTrade: 1, simulations: 200, seed: 42 };
    const a = runMonteCarloBacktest(params);
    const b = runMonteCarloBacktest(params);
    expect(a.finalCapital).toBe(b.finalCapital);
    expect(a.probProfit).toBe(b.probProfit);
  });

  it("always profits and never ruins with a 100% win rate", () => {
    const r = runMonteCarloBacktest({ initialCapital: 1000, numTrades: 50, winRate: 100, payoffRatio: 1, riskPerTrade: 1, simulations: 50, seed: 1 });
    expect(r.finalCapital).toBeGreaterThan(1000);
    expect(r.probProfit).toBe(100);
    expect(r.probRuin).toBe(0);
    expect(r.totalReturn).toBeGreaterThan(0);
  });

  it("ruins with a 0% win rate", () => {
    const r = runMonteCarloBacktest({ initialCapital: 1000, numTrades: 200, winRate: 0, payoffRatio: 2, riskPerTrade: 5, simulations: 50, seed: 2 });
    expect(r.finalCapital).toBeLessThan(1000);
    expect(r.probRuin).toBe(100);
  });

  it("computes expectancy and profit factor from the edge", () => {
    const r = runMonteCarloBacktest({ initialCapital: 10000, numTrades: 10, winRate: 50, payoffRatio: 2, riskPerTrade: 1, simulations: 10, seed: 3 });
    // E = p*payoff - (1-p) = 0.5*2 - 0.5 = 0.5 R
    expect(r.expectancy).toBeCloseTo(0.5, 5);
    // PF = (p*payoff)/(1-p) = (0.5*2)/0.5 = 2
    expect(r.profitFactor).toBeCloseTo(2, 5);
  });

  it("returns an equity curve starting at the initial capital", () => {
    const r = runMonteCarloBacktest({ initialCapital: 5000, numTrades: 120, winRate: 60, payoffRatio: 1.2, riskPerTrade: 2, simulations: 30, seed: 7 });
    expect(r.equityCurve[0]).toEqual({ trade: 0, equity: 5000 });
    expect(r.equityCurve.length).toBeGreaterThan(1);
    expect(r.numTrades).toBe(120);
  });
});
