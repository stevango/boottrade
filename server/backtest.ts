// Monte Carlo strategy simulator. Pure and deterministic given a seed — no
// external market data. Models a sequence of trades from the strategy's edge
// (win rate + payoff) and fixed-fractional risk, across many simulated paths.

export type BacktestParams = {
  initialCapital: number;
  numTrades: number;
  winRate: number; // 0-100
  payoffRatio: number; // average win / average loss (in risk units)
  riskPerTrade: number; // % of current capital risked per trade
  simulations?: number;
  seed?: number;
};

export type BacktestResult = {
  equityCurve: { trade: number; equity: number }[];
  finalCapital: number;
  totalReturn: number;
  maxDrawdown: number;
  profitFactor: number;
  expectancy: number; // in R (risk units) per trade
  winRate: number;
  probProfit: number;
  probRuin: number;
  bestCase: number;
  worstCase: number;
  simulations: number;
  numTrades: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// Small deterministic PRNG so results are reproducible for a given seed.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export function runMonteCarloBacktest(params: BacktestParams): BacktestResult {
  const simulations = clamp(Math.round(params.simulations ?? 500), 1, 2000);
  const numTrades = clamp(Math.round(params.numTrades), 1, 5000);
  const p = clamp(params.winRate, 0, 100) / 100;
  const payoff = Math.max(0.01, params.payoffRatio);
  const riskPct = clamp(params.riskPerTrade, 0.01, 100) / 100;
  const initial = Math.max(0.01, params.initialCapital);
  const ruinLevel = initial * 0.5; // a 50% drawdown counts as ruin
  const rng = mulberry32((params.seed ?? 1234567) | 0);

  // Sample ~60 points along the path for the chart.
  const step = Math.max(1, Math.floor(numTrades / 60));
  const sampledIdx: number[] = [];
  for (let t = step; t <= numTrades; t += step) sampledIdx.push(t);
  if (sampledIdx[sampledIdx.length - 1] !== numTrades) sampledIdx.push(numTrades);
  const sampleCols: number[][] = sampledIdx.map(() => []);

  const finals: number[] = [];
  const maxDDs: number[] = [];
  let profitable = 0;
  let ruined = 0;

  for (let s = 0; s < simulations; s++) {
    let equity = initial;
    let peak = initial;
    let maxDD = 0;
    let hitRuin = false;
    let si = 0;
    for (let t = 1; t <= numTrades; t++) {
      const risk = equity * riskPct;
      if (rng() < p) equity += risk * payoff;
      else equity -= risk;
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (equity - peak) / peak : 0;
      if (dd < maxDD) maxDD = dd;
      if (equity <= ruinLevel) hitRuin = true;
      if (si < sampledIdx.length && t === sampledIdx[si]) {
        sampleCols[si].push(equity);
        si++;
      }
    }
    finals.push(equity);
    maxDDs.push(maxDD);
    if (equity > initial) profitable++;
    if (hitRuin) ruined++;
  }

  const equityCurve = [
    { trade: 0, equity: initial },
    ...sampledIdx.map((t, i) => ({ trade: t, equity: median(sampleCols[i]) })),
  ];
  const finalCapital = median(finals);
  const expectancy = p * payoff - (1 - p);
  const profitFactor = 1 - p > 0 ? (p * payoff) / (1 - p) : 999;

  return {
    equityCurve,
    finalCapital,
    totalReturn: ((finalCapital - initial) / initial) * 100,
    maxDrawdown: median(maxDDs) * 100,
    profitFactor,
    expectancy,
    winRate: p * 100,
    probProfit: (profitable / simulations) * 100,
    probRuin: (ruined / simulations) * 100,
    bestCase: Math.max(...finals),
    worstCase: Math.min(...finals),
    simulations,
    numTrades,
  };
}
