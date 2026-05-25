import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, DollarSign, Target, TrendingUp, Shield, Zap, Loader2, PieChart as PieIcon, AlertTriangle, Info } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

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
  const [objective, setObjective] = useState("crescimento");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [emergencyFund, setEmergencyFund] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [aiResponse, setAiResponse] = useState("");

  const recommendMutation = trpc.allocation.recommend.useMutation({
    onSuccess: (p) => { setPlan(p as Plan); setAiResponse(""); },
    onError: () => toast.error("Não foi possível gerar a alocação."),
  });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => setAiResponse(data.response),
    onError: () => toast.error("Erro ao gerar explicação com IA."),
  });

  const handleAnalyze = () => {
    const amt = parseFloat(amount);
    if (!(amt > 0)) return toast.error("Informe um valor válido.");
    recommendMutation.mutate({
      amount: amt,
      riskProfile: riskProfile as any,
      horizon: horizon as any,
      objective: objective as any,
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      emergencyFund: emergencyFund ? parseFloat(emergencyFund) : undefined,
    });
  };

  const explainWithAI = () => {
    if (!plan) return;
    const breakdown = plan.slices.map(s => `${s.label}: ${s.percent}% (R$ ${fmtBRL(s.amount)})`).join("; ");
    const message = `Gerei esta alocação determinística para R$ ${fmtBRL(plan.total)} (perfil ${riskProfile}, horizonte ${horizon}, objetivo ${objective}): ${breakdown}. Explique em linguagem simples por que essa distribuição faz sentido, os riscos de cada parte, e sugestões de ativos específicos (ex.: tickers, fundos, tesouro). Seja direto e responsável.`;
    chatMutation.mutate({ message, context: "consultor" });
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
                  <Label className="text-sm text-muted-foreground">Objetivo</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crescimento">Crescimento de patrimônio</SelectItem>
                      <SelectItem value="renda">Geração de renda passiva</SelectItem>
                      <SelectItem value="protecao">Proteção contra inflação</SelectItem>
                      <SelectItem value="aposentadoria">Aposentadoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><PieIcon className="w-4 h-4 text-primary" /> Distribuição sugerida</CardTitle>
                      <Badge variant="outline" className="text-xs">Risco: <span className={`ml-1 font-semibold ${riskColor[plan.expectedRisk]}`}>{plan.expectedRisk}</span></Badge>
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

                {/* Breakdown table */}
                <Card className="bg-card border-border">
                  <CardContent className="p-4 space-y-2">
                    {plan.slices.map((s, i) => (
                      <div key={s.assetClass} className="flex items-start justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-start gap-3">
                          <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.label} <span className="text-xs text-muted-foreground">• {s.horizon === "medio" ? "médio" : s.horizon} prazo</span></p>
                            <p className="text-xs text-muted-foreground">{s.rationale}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-bold text-foreground">{s.percent}%</p>
                          <p className="text-xs text-muted-foreground">R$ {fmtBRL(s.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

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

                {/* Optional AI explanation */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Explicação da IA (opcional)</CardTitle>
                      <Button size="sm" variant="outline" onClick={explainWithAI} disabled={chatMutation.isPending}>
                        {chatMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />} Explicar
                      </Button>
                    </div>
                  </CardHeader>
                  {aiResponse && (
                    <CardContent>
                      <div className="prose prose-invert prose-sm max-w-none"><Streamdown>{aiResponse}</Streamdown></div>
                    </CardContent>
                  )}
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
