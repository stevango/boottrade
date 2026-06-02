import { describe, expect, it } from "vitest";
import { computeAllocation } from "./allocation";

const base = { amount: 10000, riskProfile: "moderado" as const, horizon: "medio" as const, objectives: ["crescimento" as const] };

describe("computeAllocation", () => {
  it("is deterministic", () => {
    expect(computeAllocation(base)).toEqual(computeAllocation(base));
  });

  it("amounts sum exactly to the total", () => {
    const plan = computeAllocation({ ...base, amount: 12345.67 });
    const sum = plan.slices.reduce((s, x) => s + x.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(12345.67);
  });

  it("percentages sum to ~100", () => {
    const plan = computeAllocation(base);
    const sum = plan.slices.reduce((s, x) => s + x.percent, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it("conservative holds more fixed income than aggressive", () => {
    const fixed = (p: ReturnType<typeof computeAllocation>) =>
      p.slices.filter(s => ["tesouro", "cdb", "renda_fixa"].includes(s.assetClass)).reduce((a, s) => a + s.percent, 0);
    const cons = computeAllocation({ ...base, riskProfile: "conservador" });
    const agg = computeAllocation({ ...base, riskProfile: "agressivo" });
    expect(fixed(cons)).toBeGreaterThan(fixed(agg));
  });

  it("short horizon is more defensive than long horizon", () => {
    const growth = (p: ReturnType<typeof computeAllocation>) =>
      p.slices.filter(s => ["acoes", "internacional", "cripto"].includes(s.assetClass)).reduce((a, s) => a + s.percent, 0);
    const curto = computeAllocation({ ...base, horizon: "curto" });
    const longo = computeAllocation({ ...base, horizon: "longo" });
    expect(growth(longo)).toBeGreaterThan(growth(curto));
  });

  it("includes a gold/protection sleeve and a protection tilt boosts it", () => {
    const plan = computeAllocation({ ...base, objectives: ["protecao"] });
    const ouro = plan.slices.find(s => s.assetClass === "ouro");
    expect(ouro).toBeDefined();
    const cresc = computeAllocation({ ...base, objectives: ["crescimento"] }).slices.find(s => s.assetClass === "ouro")?.percent ?? 0;
    expect((ouro?.percent ?? 0)).toBeGreaterThan(cresc);
  });

  it("accepts multiple objectives", () => {
    const plan = computeAllocation({ ...base, objectives: ["renda", "protecao"] });
    const sum = plan.slices.reduce((s, x) => s + x.percent, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
    expect(plan.slices.find(s => s.assetClass === "fii")).toBeDefined();
  });

  it("warns when the emergency reserve is below ~6 months of income", () => {
    const plan = computeAllocation({ ...base, monthlyIncome: 5000, emergencyFund: 1000 });
    expect(plan.reserveRecommendation).toMatch(/reserva/i);
  });

  it("always returns risk caveats", () => {
    expect(computeAllocation(base).warnings.length).toBeGreaterThan(0);
  });

  it("speculation sleeve is capped, isolated and adds a warning", () => {
    const plan = computeAllocation({ ...base, amount: 10000, specSleeve: { enabled: true, percent: 3 } });
    const apostas = plan.slices.find((s) => s.assetClass === "apostas");
    expect(apostas).toBeDefined();
    expect(apostas!.percent).toBeCloseTo(3, 1);
    expect(plan.warnings.some((w) => w.toLowerCase().includes("especulação"))).toBe(true);
    // Sum still ~100%.
    const sum = plan.slices.reduce((s, x) => s + x.percent, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it("speculation sleeve is hard-capped at 5%", () => {
    const plan = computeAllocation({ ...base, specSleeve: { enabled: true, percent: 50 } });
    const apostas = plan.slices.find((s) => s.assetClass === "apostas");
    expect(apostas!.percent).toBeCloseTo(5, 1);
  });
});
