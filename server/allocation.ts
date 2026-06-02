// Deterministic allocation brain. Rule-based, transparent and reproducible —
// NOT a market prediction. Produces a diversified allocation across asset
// classes and horizons, sized by risk profile/objective, with a safe-haven
// (gold/fixed income) sleeve and emergency-reserve guardrails.

export type RiskProfile = "conservador" | "moderado" | "arrojado" | "agressivo";
export type Horizon = "curto" | "medio" | "longo";
export type Objective = "crescimento" | "renda" | "protecao" | "aposentadoria";

export type AllocationInput = {
  amount: number;
  riskProfile: RiskProfile;
  horizon: Horizon;
  objectives: Objective[];
  monthlyIncome?: number;
  emergencyFund?: number;
  specSleeve?: { enabled: boolean; percent?: number };
};

export type AllocationSlice = {
  assetClass: string;
  label: string;
  percent: number;
  amount: number;
  horizon: Horizon;
  rationale: string;
};

export type AllocationPlan = {
  total: number;
  slices: AllocationSlice[];
  byHorizon: { curto: number; medio: number; longo: number };
  expectedRisk: "baixo" | "moderado" | "alto" | "muito alto";
  reserveRecommendation: string | null;
  strategy: string;
  warnings: string[];
};

type Weights = Record<string, number>;

const CLASS_META: Record<string, { label: string; horizon: Horizon; rationale: string }> = {
  tesouro: { label: "Tesouro Direto", horizon: "curto", rationale: "Segurança e liquidez; base defensiva da carteira." },
  cdb: { label: "CDB / LCI / LCA", horizon: "curto", rationale: "Renda fixa com proteção do FGC; bom para curto prazo." },
  renda_fixa: { label: "Renda Fixa (crédito)", horizon: "medio", rationale: "Carrego previsível; equilibra a volatilidade." },
  fii: { label: "Fundos Imobiliários", horizon: "medio", rationale: "Renda mensal (dividendos) e exposição a imóveis." },
  acoes: { label: "Ações", horizon: "longo", rationale: "Motor de crescimento de longo prazo." },
  internacional: { label: "Internacional (ETFs/Stocks US)", horizon: "longo", rationale: "Diversificação geográfica e exposição ao dólar." },
  ouro: { label: "Ouro / Proteção", horizon: "longo", rationale: "Reserva de valor e hedge contra crises e desvalorização cambial." },
  cripto: { label: "Criptomoedas", horizon: "longo", rationale: "Alto risco/retorno; manter pequeno e diversificado." },
  fundos: { label: "Fundos Multimercado", horizon: "medio", rationale: "Gestão ativa entre classes." },
  apostas: { label: "Especulação esportiva (Copa) — caixa isolado", horizon: "curto", rationale: "Caixa de entretenimento, capado e separado do plano de patrimônio. Use Paper Trade antes; rode com bankroll fixo e stop diário (ex.: Oracle AI)." },
};

const BASE: Record<RiskProfile, Weights> = {
  conservador: { tesouro: 35, cdb: 20, renda_fixa: 15, fii: 10, acoes: 8, internacional: 4, ouro: 6, cripto: 2 },
  moderado: { tesouro: 18, cdb: 10, renda_fixa: 12, fii: 14, acoes: 22, internacional: 11, ouro: 8, cripto: 5 },
  arrojado: { tesouro: 8, cdb: 4, renda_fixa: 8, fii: 12, acoes: 33, internacional: 18, ouro: 7, cripto: 10 },
  agressivo: { tesouro: 4, cdb: 0, renda_fixa: 4, fii: 6, acoes: 38, internacional: 20, ouro: 6, cripto: 22 },
};

const DEFENSIVE = ["tesouro", "cdb", "renda_fixa"] as const;
const GROWTH = ["acoes", "internacional", "cripto"] as const;

const OBJECTIVE_TILT: Record<Objective, Weights> = {
  crescimento: { acoes: 5, internacional: 3, cripto: 2 },
  renda: { fii: 8, acoes: 4, renda_fixa: 3 },
  protecao: { ouro: 6, tesouro: 4, internacional: 3 },
  aposentadoria: { acoes: 5, internacional: 4, fii: 3 },
};

const RISK_LABEL: Record<RiskProfile, AllocationPlan["expectedRisk"]> = {
  conservador: "baixo", moderado: "moderado", arrojado: "alto", agressivo: "muito alto",
};

function shiftBetween(w: Weights, from: readonly string[], to: readonly string[], pct: number) {
  const fromTotal = from.reduce((s, k) => s + (w[k] || 0), 0);
  if (fromTotal <= 0) return;
  const move = Math.min(pct, fromTotal);
  for (const k of from) w[k] = (w[k] || 0) - move * ((w[k] || 0) / fromTotal);
  const toTotal = to.reduce((s, k) => s + (w[k] || 0), 0) || to.length;
  for (const k of to) w[k] = (w[k] || 0) + move * (toTotal ? (w[k] || 0) / toTotal : 1 / to.length);
}

function normalize(w: Weights): Weights {
  const total = Object.values(w).reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const out: Weights = {};
  for (const [k, v] of Object.entries(w)) {
    const p = (Math.max(0, v) / total) * 100;
    if (p >= 0.5) out[k] = p;
  }
  return out;
}

export function computeAllocation(input: AllocationInput): AllocationPlan {
  const total = Math.max(0, input.amount);
  const w: Weights = { ...BASE[input.riskProfile] };

  // Horizon tilt: shorter horizon → more defensive; longer → more growth.
  if (input.horizon === "curto") shiftBetween(w, GROWTH, DEFENSIVE, 15);
  else if (input.horizon === "longo") shiftBetween(w, DEFENSIVE, GROWTH, 15);

  // Objective tilts — combine one or more objectives.
  const objectives = input.objectives.length > 0 ? input.objectives : (["crescimento"] as Objective[]);
  for (const obj of objectives) {
    for (const [k, bonus] of Object.entries(OBJECTIVE_TILT[obj])) {
      w[k] = (w[k] || 0) + bonus;
    }
  }

  let pct = normalize(w);

  // Optional speculation sleeve (e.g., World Cup): a capped, isolated cash
  // bucket for entertainment/short-term speculation, NOT counted as patrimony.
  const sleeveEnabled = !!input.specSleeve?.enabled;
  const sleevePct = sleeveEnabled ? Math.min(5, Math.max(0.5, input.specSleeve?.percent ?? 2)) : 0;
  if (sleevePct > 0) {
    const scaled: Weights = {};
    for (const [k, v] of Object.entries(pct)) scaled[k] = (v * (100 - sleevePct)) / 100;
    scaled.apostas = sleevePct;
    pct = scaled;
  }

  // Build slices with rounded amounts that sum exactly to total.
  const entries = Object.entries(pct).sort((a, b) => b[1] - a[1]);
  let allocated = 0;
  const slices: AllocationSlice[] = entries.map(([cls, percent], i) => {
    const isLast = i === entries.length - 1;
    const amount = isLast ? Math.round((total - allocated) * 100) / 100 : Math.round(total * (percent / 100) * 100) / 100;
    allocated += amount;
    const meta = CLASS_META[cls];
    return {
      assetClass: cls,
      label: meta.label,
      percent: Math.round(percent * 10) / 10,
      amount,
      horizon: meta.horizon,
      rationale: meta.rationale,
    };
  });

  const byHorizon = { curto: 0, medio: 0, longo: 0 };
  for (const s of slices) byHorizon[s.horizon] += s.percent;
  (Object.keys(byHorizon) as Horizon[]).forEach((h) => { byHorizon[h] = Math.round(byHorizon[h] * 10) / 10; });

  // Emergency reserve guardrail.
  let reserveRecommendation: string | null = null;
  const income = input.monthlyIncome ?? 0;
  if (income > 0) {
    const ideal = income * 6;
    const have = input.emergencyFund ?? 0;
    if (have < ideal) {
      reserveRecommendation = `Sua reserva de emergência (R$ ${have.toLocaleString("pt-BR")}) está abaixo do ideal (~6 meses de renda = R$ ${ideal.toLocaleString("pt-BR")}). Priorize completar a reserva em ativos líquidos e seguros (Tesouro Selic / CDB com liquidez) antes de aumentar a exposição a risco.`;
    }
  }

  const cripto = pct.cripto ?? 0;
  const warnings: string[] = [
    "Esta é uma alocação-modelo educacional e determinística, não uma recomendação de investimento personalizada nem garantia de retorno.",
    "Resultados de mercado são incertos. Reavalie periodicamente e ajuste ao seu contexto.",
  ];
  if (cripto >= 10) warnings.push("A fatia de cripto é volátil — considere limites e custódia segura.");
  if (input.horizon === "curto") warnings.push("Para curto prazo, evite concentrar em ativos voláteis: a prioridade é preservar capital e liquidez.");
  if (sleevePct > 0) warnings.push(`Caixa de especulação esportiva (${sleevePct}%) é entretenimento, não patrimônio. Use bankroll fixo, stop diário e teste no Paper Trade antes — perdas neste caixa não devem comprometer o plano.`);

  const strategy = input.riskProfile === "conservador"
    ? "Renda fixa pode ser alocada de imediato. Faça os ativos de risco em poucos aportes para suavizar o preço médio."
    : "Use aportes graduais (DCA) em 3–6 parcelas para ações, internacional e cripto, reduzindo o risco de entrada em um topo. Renda fixa pode entrar de imediato.";

  return { total, slices, byHorizon, expectedRisk: RISK_LABEL[input.riskProfile], reserveRecommendation, strategy, warnings };
}
