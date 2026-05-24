import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sparkles, DollarSign, Target, TrendingUp, Shield, Zap, Loader2, PieChart } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Streamdown } from "streamdown";

export default function SmartAllocator() {
  const [amount, setAmount] = useState<string>("");
  const [riskProfile, setRiskProfile] = useState<string>("moderado");
  const [horizon, setHorizon] = useState<string>("medio");
  const [objective, setObjective] = useState<string>("crescimento");
  const [monthlyIncome, setMonthlyIncome] = useState<string>("");
  const [emergencyFund, setEmergencyFund] = useState<string>("");
  const [aiResponse, setAiResponse] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setAiResponse(data.response);
      setIsAnalyzing(false);
    },
    onError: () => {
      setAiResponse("Erro ao gerar análise. Tente novamente.");
      setIsAnalyzing(false);
    },
  });

  const handleAnalyze = () => {
    if (!amount || parseFloat(amount) <= 0) return;

    setIsAnalyzing(true);
    setAiResponse("");

    const message = `
Tenho R$ ${parseFloat(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disponíveis para investir agora.

Meu perfil:
- Perfil de risco: ${riskProfile === "conservador" ? "Conservador (priorizo segurança)" : riskProfile === "moderado" ? "Moderado (equilíbrio risco/retorno)" : riskProfile === "arrojado" ? "Arrojado (aceito mais risco por mais retorno)" : "Agressivo (máximo retorno, aceito perdas)"}
- Horizonte: ${horizon === "curto" ? "Curto prazo (até 1 ano)" : horizon === "medio" ? "Médio prazo (1-5 anos)" : "Longo prazo (5+ anos)"}
- Objetivo principal: ${objective === "crescimento" ? "Crescimento de patrimônio" : objective === "renda" ? "Geração de renda passiva" : objective === "protecao" ? "Proteção contra inflação" : "Aposentadoria"}
${monthlyIncome ? `- Renda mensal: R$ ${parseFloat(monthlyIncome).toLocaleString("pt-BR")}` : ""}
${emergencyFund ? `- Reserva de emergência atual: R$ ${parseFloat(emergencyFund).toLocaleString("pt-BR")}` : ""}

Com base no meu patrimônio atual, metas financeiras e histórico de operações, me dê uma DIREÇÃO CLARA e ESPECÍFICA de como alocar esse valor para potencializar meus resultados. Inclua:

1. DISTRIBUIÇÃO EXATA do valor entre classes de ativos (com valores em R$ e %)
2. ATIVOS ESPECÍFICOS recomendados para cada classe (nomes reais de ações, fundos, CDBs, etc.)
3. ESTRATÉGIA de entrada (tudo de uma vez ou aportes graduais?)
4. RISCOS de cada alocação e como mitigá-los
5. PROJEÇÃO de retorno esperado em 6 meses, 1 ano e 3 anos
6. PRÓXIMOS PASSOS concretos que devo executar hoje

Seja direto, use números reais e me dê uma recomendação acionável.`;

    chatMutation.mutate({ message, context: "consultor" });
  };

  const riskProfiles = [
    { value: "conservador", label: "Conservador", icon: Shield, desc: "Segurança em primeiro lugar", color: "text-blue-400" },
    { value: "moderado", label: "Moderado", icon: Target, desc: "Equilíbrio risco/retorno", color: "text-primary" },
    { value: "arrojado", label: "Arrojado", icon: TrendingUp, desc: "Aceito mais risco", color: "text-warning" },
    { value: "agressivo", label: "Agressivo", icon: Zap, desc: "Máximo retorno", color: "text-loss" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-primary" />
            Alocação Inteligente
          </h1>
          <p className="text-muted-foreground">Informe quanto tem disponível e receba uma direção personalizada de investimento</p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Amount Input */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  Valor Disponível
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Quanto você tem para investir agora?</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="10.000,00"
                      className="pl-10 bg-secondary border-border text-lg h-12"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Renda Mensal (opcional)</Label>
                    <Input
                      type="number"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      placeholder="5.000"
                      className="bg-secondary border-border text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Reserva Emergência (opcional)</Label>
                    <Input
                      type="number"
                      value={emergencyFund}
                      onChange={(e) => setEmergencyFund(e.target.value)}
                      placeholder="15.000"
                      className="bg-secondary border-border text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Profile */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Perfil de Risco</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {riskProfiles.map((profile) => {
                    const Icon = profile.icon;
                    return (
                      <button
                        key={profile.value}
                        onClick={() => setRiskProfile(profile.value)}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          riskProfile === profile.value
                            ? "border-primary bg-primary/5"
                            : "border-border bg-secondary/30 hover:border-primary/50"
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${profile.color}`} />
                        <p className="text-xs font-medium text-foreground">{profile.label}</p>
                        <p className="text-[10px] text-muted-foreground">{profile.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Horizon & Objective */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Horizonte e Objetivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Horizonte de Investimento</Label>
                  <Select value={horizon} onValueChange={setHorizon}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curto">Curto prazo (até 1 ano)</SelectItem>
                      <SelectItem value="medio">Médio prazo (1-5 anos)</SelectItem>
                      <SelectItem value="longo">Longo prazo (5+ anos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Objetivo Principal</Label>
                  <Select value={objective} onValueChange={setObjective}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
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

            <Button
              onClick={handleAnalyze}
              disabled={!amount || parseFloat(amount) <= 0 || isAnalyzing}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analisando seu perfil...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Gerar Recomendação Personalizada
                </>
              )}
            </Button>
          </div>

          {/* AI Response Panel */}
          <div className="lg:col-span-3">
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" />
                    Recomendação do Auditor IA
                  </CardTitle>
                  {amount && parseFloat(amount) > 0 && (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      R$ {parseFloat(amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">Analisando seu patrimônio, metas e perfil...</p>
                    <p className="text-xs text-muted-foreground mt-1">Gerando recomendação personalizada</p>
                  </div>
                ) : aiResponse ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <Streamdown>{aiResponse}</Streamdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                      <Sparkles className="w-10 h-10 text-primary/30" />
                    </div>
                    <p className="text-base font-medium text-foreground mb-2">Como funciona?</p>
                    <div className="max-w-sm space-y-3 text-center">
                      <p className="text-sm text-muted-foreground">
                        1. Informe quanto você tem disponível para investir
                      </p>
                      <p className="text-sm text-muted-foreground">
                        2. Selecione seu perfil de risco e horizonte
                      </p>
                      <p className="text-sm text-muted-foreground">
                        3. O Auditor IA analisa seu patrimônio atual, metas e histórico para gerar uma direção personalizada
                      </p>
                    </div>
                    <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/10 max-w-sm">
                      <p className="text-xs text-primary font-medium mb-1">O que a IA considera:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Sua carteira atual e alocação</li>
                        <li>• Suas metas de patrimônio ativas</li>
                        <li>• Histórico de trades e performance</li>
                        <li>• Cenário econômico atual</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
