import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Brain, Zap, Target, Activity, Shield, ToggleLeft, ToggleRight, Clock, CheckCircle, XCircle, AlertTriangle, Search, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

const trendStyle = {
  alta: { label: "Alta", className: "bg-profit/10 text-profit border-profit/20", Icon: TrendingUp },
  baixa: { label: "Baixa", className: "bg-loss/10 text-loss border-loss/20", Icon: TrendingDown },
  lateral: { label: "Lateral", className: "bg-secondary text-muted-foreground border-border", Icon: Minus },
};
const decisionLabel: Record<string, string> = { buy: "COMPRAR", sell: "VENDER", hold: "AGUARDAR", close: "FECHAR" };

export default function RobotBrain() {
  const params = useParams<{ id: string }>();
  const robotId = parseInt(params.id || "1");
  const utils = trpc.useUtils();

  const { data: brain } = trpc.brain.get.useQuery({ robotId });
  const { data: decisions } = trpc.brain.decisions.useQuery({ robotId, limit: 20 });
  const { data: robot } = trpc.robots.getById.useQuery({ id: robotId });
  const { data: learning } = trpc.brain.getLearningData.useQuery({ robotId });

  const invalidate = () => {
    utils.brain.get.invalidate();
    utils.brain.decisions.invalidate();
    utils.brain.getLearningData.invalidate();
  };

  const toggleModeMutation = trpc.brain.toggleMode.useMutation({
    onSuccess: (data) => toast.success(`Modo: ${data.mode === "manual" ? "Manual" : data.mode === "semi_auto" ? "Semi-Automático" : "Automático"}`),
  });

  // Signal generation
  const [symbol, setSymbol] = useState("GOLD11");
  const [range, setRange] = useState<"1y" | "5y" | "10y">("5y");
  const [lastSignal, setLastSignal] = useState<{ trend: "alta" | "baixa" | "lateral"; trendStrength: number; summary: string } | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const analyzeMutation = trpc.brain.analyzeAsset.useMutation({
    onSuccess: (r) => {
      if (r.configured === false) { setNotConfigured(true); setLastSignal(null); return; }
      setNotConfigured(false);
      if (r.signal) { setLastSignal(r.signal as any); toast.success(`Sinal gerado: ${decisionLabel[r.decision!]} ${r.symbol}`); invalidate(); }
      else toast.error(r.message || "Sem dados.");
    },
    onError: () => toast.error("Falha ao analisar. Verifique o ativo."),
  });

  // Resolve decision
  const [resolveTarget, setResolveTarget] = useState<{ id: number; label: string } | null>(null);
  const [resolveAmount, setResolveAmount] = useState("");
  const resolveMutation = trpc.brain.resolveDecision.useMutation({
    onSuccess: () => { toast.success("Decisão resolvida — o cérebro aprendeu."); setResolveTarget(null); setResolveAmount(""); invalidate(); },
    onError: () => toast.error("Falha ao resolver."),
  });

  const doResolve = (outcome: "profit" | "loss") => {
    if (!resolveTarget) return;
    const amt = Math.abs(parseFloat(resolveAmount) || 0);
    resolveMutation.mutate({ decisionId: resolveTarget.id, outcome, profitAmount: outcome === "profit" ? amt : -amt });
  };

  const assertiveness = brain ? parseFloat(String(brain.assertiveness || "0")) : 0;
  const maturityLevel = brain?.maturityLevel || 1;
  const totalDecisions = brain?.totalDecisions || 0;
  const correctDecisions = brain?.correctDecisions || 0;
  const mode = brain?.mode || "manual";
  const autoThreshold = brain ? parseFloat(String(brain.autoThreshold || "75")) : 75;
  const canGoAuto = assertiveness >= autoThreshold;
  const maturityLabels = ["", "Iniciante", "Aprendiz", "Estudante", "Praticante", "Competente", "Proficiente", "Avançado", "Especialista", "Mestre", "Gênio"];

  const handleModeChange = (newMode: string) => {
    if (newMode === "auto" && !canGoAuto) {
      toast.error(`Assertividade mínima de ${autoThreshold}% para modo automático. Atual: ${assertiveness.toFixed(1)}%`);
      return;
    }
    toggleModeMutation.mutate({ robotId, mode: newMode as "manual" | "semi_auto" | "auto" });
  };

  const bestAssets = (learning as any)?.bestAssets ?? {};
  const bestHours = (learning as any)?.bestHours ?? {};
  const assetRows = Object.entries(bestAssets).map(([asset, v]: [string, any]) => ({
    asset, wins: v.wins || 0, losses: v.losses || 0, profit: v.profit || 0,
    winRate: (v.wins + v.losses) > 0 ? (v.wins / (v.wins + v.losses)) * 100 : 0,
  })).sort((a, b) => b.profit - a.profit);
  const hourRows = Object.entries(bestHours).map(([hour, v]: [string, any]) => ({
    hour, wins: v.wins || 0, losses: v.losses || 0,
    winRate: (v.wins + v.losses) > 0 ? (v.wins / (v.wins + v.losses)) * 100 : 0,
  })).sort((a, b) => b.winRate - a.winRate);

  const sigT = lastSignal ? trendStyle[lastSignal.trend] : null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Brain className="w-7 h-7 text-primary" /> Cérebro: {robot?.name || "Robô"}
            </h1>
            <p className="text-muted-foreground">Aprendizado evolutivo a partir de sinais de mercado e resultados reais</p>
          </div>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${mode === "auto" ? "text-profit border-profit/30 bg-profit/5" : mode === "semi_auto" ? "text-warning border-warning/30 bg-warning/5" : "text-muted-foreground border-border"}`}>
            {mode === "auto" ? "Automático" : mode === "semi_auto" ? "Semi-Auto" : "Manual"}
          </Badge>
        </div>

        {/* Status Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border"><CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Brain className="w-5 h-5 text-primary" /></div>
              <div><p className="text-xs text-muted-foreground">Maturidade</p><p className="text-lg font-bold text-foreground">Nível {maturityLevel}</p></div>
            </div>
            <p className="text-xs text-primary font-medium">{maturityLabels[maturityLevel]}</p>
            <Progress value={maturityLevel * 10} className="h-2 mt-2" />
          </CardContent></Card>

          <Card className="bg-card border-border"><CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center"><Target className="w-5 h-5 text-profit" /></div>
              <div><p className="text-xs text-muted-foreground">Assertividade</p><p className="text-lg font-bold text-foreground">{assertiveness.toFixed(1)}%</p></div>
            </div>
            <div className="flex items-center gap-2"><Progress value={assertiveness} className="h-2 flex-1" /><span className="text-xs text-muted-foreground">{autoThreshold}%</span></div>
            <p className="text-xs text-muted-foreground mt-1">{canGoAuto ? "Apto para modo automático" : `Faltam ${(autoThreshold - assertiveness).toFixed(1)}% para auto`}</p>
          </CardContent></Card>

          <Card className="bg-card border-border"><CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center"><Activity className="w-5 h-5 text-chart-3" /></div>
              <div><p className="text-xs text-muted-foreground">Decisões</p><p className="text-lg font-bold text-foreground">{totalDecisions}</p></div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-profit">{correctDecisions} corretas</span><span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{totalDecisions} no total</span>
            </div>
          </CardContent></Card>

          <Card className="bg-card border-border"><CardContent className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center"><Zap className="w-5 h-5 text-warning" /></div>
              <div><p className="text-xs text-muted-foreground">Modo</p><p className="text-lg font-bold text-foreground capitalize">{mode === "semi_auto" ? "Semi-Auto" : mode === "auto" ? "Automático" : "Manual"}</p></div>
            </div>
            <Select value={mode} onValueChange={handleModeChange}>
              <SelectTrigger className="h-8 text-xs bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="semi_auto">Semi-Automático</SelectItem>
                <SelectItem value="auto" disabled={!canGoAuto}>Automático {!canGoAuto && "(bloqueado)"}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent></Card>
        </div>

        {/* Signal generation */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Search className="w-4 h-4 text-primary" /> Gerar Sinal de Mercado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">O robô analisa a tendência de um ativo e registra uma decisão no cérebro. Depois, marque o resultado real para ele aprender.</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Ativo</Label>
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="GOLD11, PETR4..." className="bg-secondary border-border" onKeyDown={(e) => e.key === "Enter" && analyzeMutation.mutate({ robotId, symbol, range })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Período</Label>
                <div className="flex gap-1">
                  {(["1y", "5y", "10y"] as const).map(r => (
                    <button key={r} onClick={() => setRange(r)} className={`px-3 py-2 rounded-lg text-xs border ${range === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"}`}>{r === "1y" ? "1A" : r === "5y" ? "5A" : "10A"}</button>
                  ))}
                </div>
              </div>
              <Button onClick={() => analyzeMutation.mutate({ robotId, symbol, range })} disabled={analyzeMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {analyzeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />} Analisar
              </Button>
            </div>
            {notConfigured && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/5 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Feed de mercado não configurado. Defina <code className="text-primary">BRAPI_TOKEN</code> no servidor para o robô analisar ativos.</p>
              </div>
            )}
            {sigT && lastSignal && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                <Badge variant="outline" className={sigT.className}><sigT.Icon className="w-3 h-3 mr-1" /> {sigT.label} • força {lastSignal.trendStrength}%</Badge>
                <p className="text-xs text-muted-foreground">{lastSignal.summary}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mode Explanation */}
        <Card className="bg-card border-border"><CardContent className="p-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-lg border ${mode === "manual" ? "border-primary bg-primary/5" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-2"><ToggleLeft className="w-5 h-5 text-muted-foreground" /><span className="font-semibold text-foreground text-sm">Manual</span></div>
              <p className="text-xs text-muted-foreground">Você decide. O robô observa, registra sinais e aprende com os resultados.</p>
            </div>
            <div className={`p-4 rounded-lg border ${mode === "semi_auto" ? "border-warning bg-warning/5" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center gap-2 mb-2"><Shield className="w-5 h-5 text-warning" /><span className="font-semibold text-foreground text-sm">Semi-Automático</span></div>
              <p className="text-xs text-muted-foreground">O robô sugere com base no aprendizado. Você aprova cada decisão.</p>
            </div>
            <div className={`p-4 rounded-lg border ${mode === "auto" ? "border-profit bg-profit/5" : "border-border bg-secondary/20"} ${!canGoAuto && "opacity-50"}`}>
              <div className="flex items-center gap-2 mb-2"><ToggleRight className="w-5 h-5 text-profit" /><span className="font-semibold text-foreground text-sm">Automático</span></div>
              <p className="text-xs text-muted-foreground">{canGoAuto ? "Opera de forma autônoma com o conhecimento acumulado." : `Requer ${autoThreshold}% de assertividade para desbloquear.`}</p>
            </div>
          </div>
        </CardContent></Card>

        {/* Tabs */}
        <Tabs defaultValue="decisions">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="decisions">Histórico de Decisões</TabsTrigger>
            <TabsTrigger value="learning">Aprendizado</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3"><CardTitle className="text-base">Decisões do Cérebro</CardTitle></CardHeader>
              <CardContent>
                {decisions && decisions.length > 0 ? (
                  <div className="space-y-2">
                    {decisions.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.outcome === "profit" ? "bg-profit/10" : d.outcome === "loss" ? "bg-loss/10" : d.outcome === "pending" ? "bg-warning/10" : "bg-muted"}`}>
                            {d.outcome === "profit" ? <CheckCircle className="w-4 h-4 text-profit" /> : d.outcome === "loss" ? <XCircle className="w-4 h-4 text-loss" /> : d.outcome === "pending" ? <Clock className="w-4 h-4 text-warning" /> : <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{decisionLabel[d.decision] || d.decision.toUpperCase()} {d.asset}</p>
                            <p className="text-xs text-muted-foreground">Confiança: {parseFloat(d.confidence).toFixed(0)}% • {d.executedBy === "robot" ? "Robô" : "Humano"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {d.profitAmount && (
                            <p className={`text-sm font-bold ${parseFloat(d.profitAmount) >= 0 ? "text-profit" : "text-loss"}`}>{parseFloat(d.profitAmount) >= 0 ? "+" : ""}R$ {parseFloat(d.profitAmount).toFixed(2)}</p>
                          )}
                          {d.outcome === "pending" ? (
                            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setResolveTarget({ id: d.id, label: `${decisionLabel[d.decision] || d.decision} ${d.asset}` }); setResolveAmount(""); }}>Resolver</Button>
                          ) : (
                            <Badge variant="outline" className="text-xs">{d.outcome === "profit" ? "Acerto" : d.outcome === "loss" ? "Erro" : "Neutro"}</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma decisão registrada ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">Gere um sinal de mercado acima para o cérebro começar a aprender.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learning" className="mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3"><CardTitle className="text-base">Ativos por Performance</CardTitle></CardHeader>
                <CardContent>
                  {assetRows.length > 0 ? (
                    <div className="space-y-2">
                      {assetRows.map((a) => (
                        <div key={a.asset} className="flex justify-between text-xs items-center">
                          <span className="text-muted-foreground">{a.asset} <span className="text-[10px]">({a.wins}V/{a.losses}D)</span></span>
                          <span className={a.profit >= 0 ? "text-profit" : "text-loss"}>{a.profit >= 0 ? "+" : ""}R$ {a.profit.toFixed(2)} • {a.winRate.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground py-6 text-center">Sem dados ainda. Resolva decisões para o cérebro aprender.</p>}
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3"><CardTitle className="text-base">Melhores Horários</CardTitle></CardHeader>
                <CardContent>
                  {hourRows.length > 0 ? (
                    <div className="space-y-2">
                      {hourRows.map((h) => (
                        <div key={h.hour} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{String(h.hour).padStart(2, "0")}h <span className="text-[10px]">({h.wins}V/{h.losses}D)</span></span>
                          <span className={h.winRate >= 50 ? "text-profit" : "text-warning"}>{h.winRate.toFixed(0)}% acerto</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-muted-foreground py-6 text-center">Sem dados ainda.</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Resolve dialog */}
      <Dialog open={resolveTarget !== null} onOpenChange={(o) => !o && setResolveTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Resolver: {resolveTarget?.label}</DialogTitle></DialogHeader>
          <div className="space-y-2 mt-2">
            <Label className="text-sm text-muted-foreground">Resultado financeiro (R$)</Label>
            <Input type="number" inputMode="decimal" autoFocus value={resolveAmount} onChange={(e) => setResolveAmount(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
            <p className="text-[11px] text-muted-foreground">Informe o valor e marque se a decisão deu lucro ou prejuízo.</p>
          </div>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="outline" className="text-loss border-loss/30 hover:bg-loss/10" disabled={resolveMutation.isPending} onClick={() => doResolve("loss")}>
              <XCircle className="w-4 h-4 mr-1" /> Prejuízo
            </Button>
            <Button className="bg-profit hover:bg-profit/90 text-white" disabled={resolveMutation.isPending} onClick={() => doResolve("profit")}>
              <CheckCircle className="w-4 h-4 mr-1" /> Lucro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
