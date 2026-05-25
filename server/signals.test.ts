import { describe, expect, it } from "vitest";
import { analyzeSeries, type PricePoint } from "./signals";

const DAY = 86_400_000;
function series(values: number[]): PricePoint[] {
  return values.map((close, i) => ({ date: i * DAY, close }));
}

describe("analyzeSeries", () => {
  it("returns null for insufficient data", () => {
    expect(analyzeSeries([])).toBeNull();
    expect(analyzeSeries(series([100]))).toBeNull();
  });

  it("detects an uptrend in a rising series", () => {
    const r = analyzeSeries(series(Array.from({ length: 300 }, (_, i) => 100 + i)))!;
    expect(r.trend).toBe("alta");
    expect(r.lastPrice).toBe(399);
    const oneYear = r.returns.find(x => x.days === 252)!;
    expect(oneYear.percent).not.toBeNull();
    expect(oneYear.percent!).toBeGreaterThan(0);
  });

  it("detects a downtrend in a falling series", () => {
    const r = analyzeSeries(series(Array.from({ length: 300 }, (_, i) => 400 - i)))!;
    expect(r.trend).toBe("baixa");
  });

  it("computes a non-positive max drawdown", () => {
    const r = analyzeSeries(series([100, 120, 80, 90, 130, 110]))!;
    expect(r.maxDrawdown).toBeLessThanOrEqual(0);
  });

  it("returns null long-window returns when history is short", () => {
    const r = analyzeSeries(series(Array.from({ length: 60 }, (_, i) => 100 + i)))!;
    expect(r.returns.find(x => x.days === 252 * 10)!.percent).toBeNull();
    expect(r.returns.find(x => x.days === 21)!.percent).not.toBeNull();
  });

  it("is deterministic", () => {
    const s = series(Array.from({ length: 280 }, (_, i) => 100 + Math.sin(i / 10) * 5 + i * 0.3));
    expect(analyzeSeries(s)).toEqual(analyzeSeries(s));
  });
});
