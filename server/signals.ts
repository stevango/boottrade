// Pure, deterministic trend/signal engine. Given a daily price series it
// classifies the trend and computes transparent, explainable metrics. This is
// the "brain reading the chart" — descriptive analytics, NOT a prediction.

export type PricePoint = { date: number; close: number };

export type TrendSignal = {
  lastPrice: number;
  trend: "alta" | "baixa" | "lateral";
  trendStrength: number; // 0-100, how aligned the signals are
  returns: { label: string; days: number; percent: number | null }[];
  sma50: number | null;
  sma200: number | null;
  maxDrawdown: number; // % (<= 0)
  annualizedVolatility: number | null; // %
  summary: string;
};

function sma(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((s, v) => s + v, 0) / period;
}

function pctChangeBack(closes: number[], days: number): number | null {
  if (closes.length <= days) return null;
  const past = closes[closes.length - 1 - days];
  const last = closes[closes.length - 1];
  if (!(past > 0)) return null;
  return ((last - past) / past) * 100;
}

export function analyzeSeries(points: PricePoint[]): TrendSignal | null {
  const sorted = [...points].filter(p => Number.isFinite(p.close) && p.close > 0).sort((a, b) => a.date - b.date);
  if (sorted.length < 2) return null;
  const closes = sorted.map(p => p.close);
  const lastPrice = closes[closes.length - 1];

  const s50 = sma(closes, 50);
  const s200 = sma(closes, 200);

  // Slope of the recent short MA (last ~21 points) to capture direction.
  const recent = closes.slice(Math.max(0, closes.length - 21));
  const slope = recent.length >= 2 ? (recent[recent.length - 1] - recent[0]) / recent[0] : 0;

  // Trend classification from MA alignment + slope.
  let upScore = 0;
  let total = 0;
  if (s50 !== null) { total++; if (lastPrice > s50) upScore++; }
  if (s50 !== null && s200 !== null) { total++; if (s50 > s200) upScore++; }
  total++; if (slope > 0.01) upScore++; else if (slope < -0.01) upScore += 0; else upScore += 0.5;

  const ratio = total > 0 ? upScore / total : 0.5;
  let trend: TrendSignal["trend"];
  if (ratio >= 0.66) trend = "alta";
  else if (ratio <= 0.34) trend = "baixa";
  else trend = "lateral";
  const trendStrength = Math.round(Math.abs(ratio - 0.5) * 2 * 100);

  const returns = [
    { label: "1 mês", days: 21 },
    { label: "6 meses", days: 126 },
    { label: "1 ano", days: 252 },
    { label: "5 anos", days: 252 * 5 },
    { label: "10 anos", days: 252 * 10 },
  ].map(w => ({ ...w, percent: pctChangeBack(closes, w.days) }));

  // Max drawdown over the whole series.
  let peak = closes[0];
  let maxDD = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = (c - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }

  // Annualized volatility from daily returns.
  let annualizedVolatility: number | null = null;
  if (closes.length >= 30) {
    const rets: number[] = [];
    for (let i = 1; i < closes.length; i++) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    annualizedVolatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  const oneYear = returns.find(r => r.days === 252)?.percent ?? null;
  const summary = `Tendência de ${trend} (força ${trendStrength}%).` +
    (oneYear !== null ? ` Retorno de 12 meses: ${oneYear >= 0 ? "+" : ""}${oneYear.toFixed(1)}%.` : "") +
    ` Drawdown máximo no período: ${(maxDD * 100).toFixed(1)}%.`;

  return { lastPrice, trend, trendStrength, returns, sma50: s50, sma200: s200, maxDrawdown: maxDD * 100, annualizedVolatility, summary };
}
