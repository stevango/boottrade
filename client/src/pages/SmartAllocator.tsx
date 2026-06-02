import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, DollarSign, Target, TrendingUp, Shield, Zap, Loader2, PieChart as PieIcon, AlertTriangle, Info } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { AdvisorPanel } from "@/components/AdvisorPanel";

const COLORS = ["#00d4aa", "#00ff88", "#7c3aed", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6", "#eab308"];
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Slice = { assetClass: string; label: string; percent: number; amount: number; horizon: "curto" | "medio" | "longo"; rationale: string };
type Plan = {
  total: number; slices: Slice[]; byHorizon: { curto: number; medio: number; longo: number };
  expectedRisk: "baixo" | "moderado" | "alto" | "muito alto"; reserveRecommendation: string | null;
  strategy: string; warnings: string[];
};

const riskColor: Record<Plan["expectedRisk"], string> = {
  baixo: "text-blue-400", moderado: "text-primary", alto: "text-warning", "muito alto": "text-loss",
};

export default function SmartAllocator() {
  const [amount, setAmount] = useState("");
  const [riskProfile, setRiskProfile] = useState("moderado");
  const [horizon, setHorizon] = useState("medio");
  const [objectives, setObjectives] = useState<string[]>(["crescimento"]);
  const [specEnabled, setSpecEnabled] = useState(false);
  const [specPercent, setSpecPercent] = useState("2");
  const toggleObjective = (v: string) =>
    setObjectives((prev) => prev.includes(v) ? (prev.length > 1 ? prev.filter((o) => o !== v) : prev) : [...prev, v]);
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [emergencyFund, setEmergencyFund] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);

  const utils = trpc.useUtils();
  const recommendMutation = trpc.allocation.recommend.useMutation({
    onSuccess: (p) => setPlan(p as Plan),
    onError: () => toast.error("Não foi possível gerar a alocação."),
  });

  const saveGoalsMutation = trpc.goals.addMany.useMutation({
    onSuccess: (r) => { toast.success(`${r.count} meta(s) criada(s). Acompanhe em Metas.`); utils.goals.list.invalidate(); },
    onError: () => toast.error("Não foi possível salvar as metas."),
  });

  const saveAsGoals = () => {
    if (!plan) return;
    const now = new Date();
    const horizonMeta = {
      curto: { years: 1, category: "emergencia" as const, label: "Curto prazo" },
      medio: { years: 3, category: "patrimonio" as const, label: "Médio prazo" },
      longo: { years: 7, category: "aposentadoria" as const, label: "Longo prazo" },
    };
    const goals = (["curto", "medio", "longo"] as const)
      .map((h) => {
        const total = plan.slices.filter((s) => s.horizon === h).reduce((a, s) => a + s.amount, 0);
        if (total <= 0) return null;
        const m = horizonMeta[h];
        const deadline = new Date(now.getFullYear() + m.years, now.getMonth(), now.getDate());
        return { title: `Plano de alocação — ${m.label}`, targetAmount: Math.round(total * 100) / 100, category: m.category, deadline: deadline.toISOString() };
      })
      .filter((g): g is NonNullable<typeof g> => g !== null);
    if (goals.length === 0) return;
    saveGoalsMutation.mutate({ goals });
  };

  const handleAnalyze = () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error("Informe um valor válido.");
    recommendMutation.mutate({
      amount: amt,
      riskProfile: riskProfile as any,
      horizon: horizon as any,
      objectives: objectives as any,
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      emergencyFund: emergencyFund ? parseFloat(emergencyFund) : undefined,
      specSleeve: specEnabled ? { enabled: true, percent: Math.min(5, Math.max(0.5, parseFloat(specPercent) || 2)) } : undefined,
    });
  };

  const advisorContext = () => {
    if (!plan) return "";
    const breakdown = plan.slices.map(s => `${s.label}: ${s.percent}% (R$ ${fmtBRL(s.amount)}, ${s.horizon} prazo)`).join("; ");
    return `Plano de alocação para R$ ${fmtBRL(plan.total)} — perfil ${riskProfile}, horizonte ${horizon}, objetivos: ${objectives.join(", ")}.
Distribuição: ${breakdown}.
Por horizonte: curto ${plan.byHorizon.curto}%, médio ${plan.byHorizon.medio}%, longo ${plan.byHorizon.longo}%.
Risco esperado: ${plan.expectedRisk}.${plan.reserveRecommendation ? ` Reserva: ${plan.reserveRecommendation}` : ""}
Avalie se a distribuição faz sentido, o que corrigir, oportunidades para potencializar respeitando o risco, e sugira ativos específicos (tickers/fundos/tesouro).`;
  };

  const chartData = plan?.slices.map((s, i) => ({ name: s.label, value: s.percent, color: COLORS[i % COLORS.length] })) ?? [];

  const riskProfiles = [
    { value: "conservador", label: "Conservador", icon: Shield, desc: "Segurança primeiro", color: "text-blue-400" },
    { value: "moderado", label: "Moderado", icon: Target, desc: "Equilíbrio", color: "text-primary" },
    { value: "arrojado", label: "Arrojado", icon: TrendingUp, desc: "Mais risco", color: "text-warning" },
    { value: "agressivo", label: "Agressivo", icon: Zap, desc: "Máximo retorno", color: "text-loss" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-primary" /> Alocação Inteligente
          </h1>
          <p className="text-muted-foreground">Plano de alocação determinístico e transparente — curto, médio e longo prazo, com proteção</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><DollarSign className="w-4 h-4 text-primary" /> Valor Disponível</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quanto investir agora?</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10.000,00" className="pl-10 bg-secondary border-border text-lg h-12" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Renda Mensal (opcional)</Label>
                    <Input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} placeholder="5.000" className="bg-secondary border-border text-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Reserva atual (opcional)</Label>
                    <Input type="number" value={emergencyFund} onChange={(e) => setEmergencyFund(e.target.value)} placeholder="15.000" className="bg-secondary border-border text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Perfil de Risco</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {riskProfiles.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button key={p.value} onClick={() => setRiskProfile(p.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${riskProfile === p.value ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/50"}`}>
                        <Icon className={`w-4 h-4 mb-1 ${p.color}`} />
                        <p className="text-xs font-medium text-foreground">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Horizonte e Objetivo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Horizonte</Label>
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curto">Curto prazo (até 1 ano)</SelectItem>
                      <SelectItem value="medio">Médio prazo (1-5 anos)</SelectItem>
                      <SelectItem value="longo">Longo prazo (5+ anos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Objetivos (pode escolher mais de um)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "crescimento", label: "Crescimento" },
                      { value: "renda", label: "Renda passiva" },
                      { value: "protecao", label: "Proteção (inflação)" },
                      { value: "aposentadoria", label: "Aposentadoria" },
                    ].map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => toggleObjective(o.value)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-all ${objectives.includes(o.value) ? "border-primary bg-primary/5 text-foreground" : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/50"}`}
                      >
                        {objectives.includes(o.value) ? "✓ " : ""}{o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Caixa de especulação (opcional)</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Aproveitar a Copa</p>
                    <p className="text-xs text-muted-foreground">Caixa isolado e capado para trade esportivo (ex.: Oracle AI). Não conta como patrimônio.</p>
                  </div>
                  <Switch checked={specEnabled} onCheckedChange={setSpecEnabled} />
                </div>
                {specEnabled && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">% do capital (máx. 5%)</Label>
                    <Input type="number" step="0.5" min="0.5" max="5" value={specPercent} onChange={(e) => setSpecPercent(e.target.value)} className="bg-secondary border-border" />
                    <p className="text-[11px] text-muted-foreground">Recomendado: 1–3%. Teste a estratégia no Paper Trade antes e use bankroll fixo + stop diário.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={handleAnalyze} disabled={!amount || parseFloat(amount) <= 0 || recommendMutation.isPending}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base">
              {recommendMutation.isPending ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Calculando...</> : <><Sparkles className="w-5 h-5 mr-2" /> Gerar Alocação</>}
            </Button>
          </div>

          {/* Output Panel */}
          <div className="lg:col-span-3 space-y-4">
            {!plan ? (
              <Card className="bg-card border-border h-full">
                <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                    <PieIcon className="w-10 h-10 text-primary/30" />
                  </div>
                  <p className="text-base font-medium text-foreground mb-2">Plano de alocação transparente</p>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Informe valor, perfil e horizonte. O plano é determinístico (mesma entrada → mesma saída), com proteção e divisão por prazo.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4 text-primary" /> Distribuição sugerida</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">Risco: <span className={`ml-1 font-semibold ${riskColor[plan.expectedRisk]}`}>{plan.expectedRisk}</span></Badge>
                        <Button size="sm" variant="outline" className="text-xs" onClick={saveAsGoals} disabled={saveGoalsMutation.isPending}>
                          {saveGoalsMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Target className="w-3 h-3 mr-1" />} Transformar em metas
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4 items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" stroke="oklch(0.12 0.01 260)" strokeWidth={2}>
                            {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} formatter={(v: number) => [`${v}%`, ""]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {(["curto", "medio", "longo"] as const).map((h) => (
                          <div key={h} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground capitalize">{h === "medio" ? "médio" : h} prazo</span>
                            <span className="text-foreground font-medium">{plan.byHorizon[h]}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Breakdown grouped by horizon */}
                {([
                  { h: "curto" as const, title: "Curto prazo", sub: "até 1 ano · liquidez e segurança" },
                  { h: "medio" as const, title: "Médio prazo", sub: "1–5 anos · equilíbrio" },
                  { h: "longo" as const, title: "Longo prazo", sub: "5+ anos · crescimento" },
                ]).map(({ h, title, sub }) => {
                  const group = plan.slices.filter((s) => s.horizon === h);
                  if (group.length === 0) return null;
                  const groupTotal = group.reduce((a, s) => a + s.amount, 0);
                  return (
                    <Card key={h} className="bg-card border-border">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
                            <p className="text-[11px] text-muted-foreground">{sub}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">R$ {fmtBRL(groupTotal)}</p>
                            <p className="text-[11px] text-muted-foreground">{plan.byHorizon[h]}% do total</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {group.map((s) => {
                          const idx = plan.slices.indexOf(s);
                          return (
                            <div key={s.assetClass} className="flex items-start justify-between p-3 rounded-lg bg-secondary/30">
                              <div className="flex items-start gap-3">
                                <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                <div>
                                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                                  <p className="text-xs text-muted-foreground">{s.rationale}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-sm font-bold text-foreground">{s.percent}%</p>
                                <p className="text-xs text-muted-foreground">R$ {fmtBRL(s.amount)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Reserve + strategy + warnings */}
                {plan.reserveRecommendation && (
                  <Card className="bg-warning/5 border-warning/20">
                    <CardContent className="p-4 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground leading-relaxed">{plan.reserveRecommendation}</p>
                    </CardContent>
                  </Card>
                )}
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground leading-relaxed"><strong className="text-foreground">Estratégia de entrada:</strong> {plan.strategy}</p>
                    </div>
                    {plan.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground leading-relaxed pl-6">• {w}</p>
                    ))}
                  </CardContent>
                </Card>

                {/* AI consultant */}
                <AdvisorPanel
                  topic="alocacao"
                  title="Consultor de Alocação IA"
                  description="A IA analisa este plano e orienta o que corrigir e como potencializar respeitando seu risco."
                  getContext={advisorContext}
                  buttonLabel="Orientar"
                />
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
