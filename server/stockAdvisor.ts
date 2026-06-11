// Stock/crypto advisor — generates SIM/NÃO/CAUTELOSO recommendations for
// non-sports signals (Athena B3, Kraken crypto). Mirrors the matchAnalysis
// advisor pattern but uses purely technical data we already have on each
// brain_decision (no external API beyond brapi/MB for fresh prices).

import { chatComplete } from "./llm";
import { fetchDailyHistory } from "./marketData";
import { fetchCryptoCandles } from "./cryptoData";
import { analyzeSeries } from "./signals";

export type StockAdviseInput = {
  symbol: string;
  side: "buy" | "sell";
  confidence: number;
  bestPrice: number;
  reasoning?: string;
  assetClass: "stock" | "crypto";
};

export type StockIntelligence = {
  decision: "SIM" | "NÃO" | "CAUTELOSO";
  reason: string;
  trend: "alta" | "baixa" | "lateral" | "desconhecida";
  trendStrength: number;
  lastPrice: number;
  sma50: number | null;
  sma200: number | null;
  annualizedVolatility: number | null;
  oneYearReturnPct: number | null;
  recommendedStakeBrl: number;
  bullets: string[];
};

const MAX_STAKE_PCT_PER_TRADE = 5;
const KELLY_FRACTION = 0.25;

// Pull the latest series so the advice reflects today's chart, not just
// the snapshot from when the signal was generated (which can be hours old).
async function freshSeries(symbol: string, assetClass: "stock" | "crypto") {
  if (assetClass === "crypto") {
    const candles = await fetchCryptoCandles(symbol, "1d", 90);
    return { points: candles.map((c) => ({ date: c.timestamp, close: c.close })) };
  }
  const ranges = ["6mo", "3mo", "1mo"];
  for (const range of ranges) {
    try {
      const h = await fetchDailyHistory(symbol, range);
      if (h.points && h.points.length >= 30) return h;
    } catch { /* try next */ }
  }
  return { points: [] };
}

export function computeStockIntelligence(input: StockAdviseInput, an: ReturnType<typeof analyzeSeries> | null, bankrollBrl: number): StockIntelligence {
  const bullets: string[] = [];
  if (!an) {
    return {
      decision: "CAUTELOSO", reason: "Sem dados técnicos suficientes pra confirmar o sinal.",
      trend: "desconhecida", trendStrength: 0, lastPrice: input.bestPrice,
      sma50: null, sma200: null, annualizedVolatility: null, oneYearReturnPct: null,
      recommendedStakeBrl: Math.min(bankrollBrl * 0.005, 100),
      bullets: ["Sem dados pra validar — stake mínimo defensivo."],
    };
  }

  const oneYear = an.returns.find((r) => r.days === 252)?.percent ?? null;
  const matchesSignal = (input.side === "buy" && an.trend === "alta") || (input.side === "sell" && an.trend === "baixa");
  const vol = an.annualizedVolatility ?? 30;

  let decision: StockIntelligence["decision"] = "CAUTELOSO";
  let reason = "";
  let stakePct = 0;

  if (!matchesSignal) {
    decision = "NÃO";
    reason = `Tendência atual (${an.trend}, força ${an.trendStrength}%) não confirma o sinal ${input.side.toUpperCase()}. Mercado se moveu desde a geração.`;
    bullets.push(reason);
    stakePct = 0;
  } else if (an.trendStrength < 50) {
    decision = "CAUTELOSO";
    reason = `Tendência de ${an.trend} fraca (${an.trendStrength}%). Sinal direcional mas sem convicção forte.`;
    bullets.push(reason);
    stakePct = 0.5;
  } else if (vol > 60) {
    decision = "CAUTELOSO";
    reason = `Tendência de ${an.trend} (${an.trendStrength}%) mas volatilidade alta (${vol.toFixed(0)}% anualizada). Stake reduzido pra controle de risco.`;
    bullets.push(reason);
    bullets.push(`Volatilidade anualizada: ${vol.toFixed(1)}%`);
    stakePct = 1;
  } else if (an.trendStrength >= 80) {
    decision = "SIM";
    // Kelly-style sizing based on conviction
    const kelly = (an.trendStrength / 100 - 0.5) * KELLY_FRACTION * 100;
    stakePct = Math.min(MAX_STAKE_PCT_PER_TRADE, Math.max(0.5, kelly));
    reason = `Tendência de ${an.trend} muito forte (${an.trendStrength}%). Volatilidade controlada (${vol.toFixed(0)}%). Stake Kelly-fracionário ${stakePct.toFixed(2)}%.`;
    bullets.push(reason);
    bullets.push(`Quarter-Kelly puro: ${(kelly).toFixed(2)}% (cap ${MAX_STAKE_PCT_PER_TRADE}%)`);
  } else {
    decision = "SIM";
    stakePct = Math.min(2, an.trendStrength / 100);
    reason = `Tendência de ${an.trend} alinhada (${an.trendStrength}%). Stake flat conservador (${stakePct.toFixed(2)}%).`;
    bullets.push(reason);
  }

  if (an.sma50 && an.sma200) {
    if (an.sma50 > an.sma200) bullets.push(`Golden Cross ativo (MM50 R$ ${an.sma50.toFixed(2)} > MM200 R$ ${an.sma200.toFixed(2)})`);
    else bullets.push(`Death Cross ativo (MM50 R$ ${an.sma50.toFixed(2)} < MM200 R$ ${an.sma200.toFixed(2)})`);
  }
  if (oneYear != null) bullets.push(`Retorno 12m: ${oneYear >= 0 ? "+" : ""}${oneYear.toFixed(1)}%`);

  const recommendedStakeBrl = Math.round((bankrollBrl * stakePct / 100) * 100) / 100;
  return {
    decision, reason,
    trend: an.trend, trendStrength: an.trendStrength, lastPrice: an.lastPrice,
    sma50: an.sma50, sma200: an.sma200, annualizedVolatility: an.annualizedVolatility, oneYearReturnPct: oneYear,
    recommendedStakeBrl, bullets,
  };
}

export function buildStockAdvisorPrompt(input: StockAdviseInput, intel: StockIntelligence, bankrollBrl: number): string {
  return [
    `Ativo: ${input.symbol} (${input.assetClass === "crypto" ? "crypto BRL" : "B3"})`,
    `Sinal do robô: ${input.side.toUpperCase()} @ R$ ${input.bestPrice.toFixed(2)} (confiança ${input.confidence.toFixed(0)}%)`,
    `Raciocínio do robô: ${input.reasoning ?? "—"}`,
    "",
    `Análise técnica atual:`,
    `- Preço: R$ ${intel.lastPrice.toFixed(2)}`,
    `- Tendência: ${intel.trend} (força ${intel.trendStrength}%)`,
    intel.sma50 != null ? `- MM50: R$ ${intel.sma50.toFixed(2)}` : "",
    intel.sma200 != null ? `- MM200: R$ ${intel.sma200.toFixed(2)}` : "",
    intel.annualizedVolatility != null ? `- Volatilidade anualizada: ${intel.annualizedVolatility.toFixed(1)}%` : "",
    intel.oneYearReturnPct != null ? `- Retorno 12m: ${intel.oneYearReturnPct.toFixed(1)}%` : "",
    "",
    `Bankroll: R$ ${bankrollBrl.toFixed(2)}`,
    "",
    "DECISÃO JÁ CALCULADA (use esses números, não invente outros):",
    `- Decisão: ${intel.decision}`,
    `- Stake: ${intel.recommendedStakeBrl.toFixed(2)} (R$ ${intel.recommendedStakeBrl.toFixed(2)})`,
    `- Razão: ${intel.reason}`,
    "",
    "Responda exatamente 6 linhas, sem markdown, sem asteriscos, formato:",
    "",
    `DECISÃO: ${intel.decision}`,
    `TAMANHO: R$ ${intel.recommendedStakeBrl.toFixed(2)}`,
    intel.decision === "SIM"
      ? `OPERAÇÃO: ${input.side.toUpperCase()} ${input.symbol} a mercado, stake R$ ${intel.recommendedStakeBrl.toFixed(2)}`
      : "OPERAÇÃO: -",
    "ALTERNATIVA: outra estratégia possível (ex: aguardar pullback, dividir entrada em 2-3 tranches) ou traço",
    "RISCO: principal risco em 1 frase",
    "RESUMO: justificativa final em 1-2 frases — explique a decisão acima usando os números do modelo",
    "",
    "Não desobedeça a decisão pré-calculada. Não invente preços.",
  ].filter(Boolean).join("\n");
}

export async function adviseStock(input: StockAdviseInput, bankrollBrl: number): Promise<{ intelligence: StockIntelligence; advice: string }> {
  const series = await freshSeries(input.symbol, input.assetClass);
  const an = analyzeSeries(series.points);
  const intelligence = computeStockIntelligence(input, an, bankrollBrl);
  const prompt = buildStockAdvisorPrompt(input, intelligence, bankrollBrl);
  const advice = await chatComplete([
    { role: "system", content: "Você é um consultor de investimentos estatístico, direto e honesto. Receba uma decisão DETERMINÍSTICA pré-calculada e EXPLIQUE com os números fornecidos. Nunca invente preços ou números. Português, sem markdown." },
    { role: "user", content: prompt },
  ]);
  return { intelligence, advice };
}
