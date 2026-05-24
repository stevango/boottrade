import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Zap, Target, TrendingUp, Activity, Shield, ToggleLeft, ToggleRight, Bot, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useParams } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function RobotBrain() {
  const params = useParams<{ id: string }>();
  const robotId = parseInt(params.id || "1");
  const [selectedMode, setSelectedMode] = useState<string>("");

  const { data: brain, isLoading: brainLoading } = trpc.brain.get.useQuery({ robotId });
  const { data: decisions, isLoading: decisionsLoading } = trpc.brain.decisions.useQuery({ robotId, limit: 20 });
  const { data: robot } = trpc.robots.getById.useQuery({ id: robotId });

  const toggleModeMutation = trpc.brain.toggleMode.useMutation({
    onSuccess: (data) => {
      toast.success(`Modo alterado para: ${data.mode === "manual" ? "Manual" : data.mode === "semi_auto" ? "Semi-Automático" : "Automático"}`);
    },
  });

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
      toast.error(`Assertividade mínima de ${autoThreshold}% necessária para modo automático. Atual: ${assertiveness.toFixed(1)}%`);
      return;
    }
    toggleModeMutation.mutate({ robotId, mode: newMode as "manual" | "semi_auto" | "auto" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Brain className="w-7 h-7 text-primary" />
              Cérebro: {robot?.name || "Robô"}
            </h1>
            <p className="text-muted-foreground">Sistema de aprendizado evolutivo e inteligência adaptativa</p>
          </div>
          <Badge variant="outline" className={`text-sm px-3 py-1 ${
            mode === "auto" ? "text-profit border-profit/30 bg-profit/5" :
            mode === "semi_auto" ? "text-warning border-warning/30 bg-warning/5" :
            "text-muted-foreground border-border"
          }`}>
            {mode === "auto" ? "Automático" : mode === "semi_auto" ? "Semi-Auto" : "Manual"}
          </Badge>
        </div>

        {/* Brain Status Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Maturidade</p>
                  <p className="text-lg font-bold text-foreground">Nível {maturityLevel}</p>
                </div>
              </div>
              <p className="text-xs text-primary font-medium">{maturityLabels[maturityLevel]}</p>
              <Progress value={maturityLevel * 10} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-profit" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assertividade</p>
                  <p className="text-lg font-bold text-foreground">{assertiveness.toFixed(1)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={assertiveness} className="h-2 flex-1" />
                <span className="text-xs text-muted-foreground">{autoThreshold}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {canGoAuto ? "Apto para modo automático" : `Faltam ${(autoThreshold - assertiveness).toFixed(1)}% para auto`}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Decisões</p>
                  <p className="text-lg font-bold text-foreground">{totalDecisions}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-profit">{correctDecisions} corretas</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-loss">{totalDecisions - correctDecisions} erradas</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Modo</p>
                  <p className="text-lg font-bold text-foreground capitalize">
                    {mode === "semi_auto" ? "Semi-Auto" : mode === "auto" ? "Automático" : "Manual"}
                  </p>
                </div>
              </div>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="semi_auto">Semi-Automático</SelectItem>
                  <SelectItem value="auto" disabled={!canGoAuto}>
                    Automático {!canGoAuto && "(bloqueado)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Mode Explanation */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border transition-all ${mode === "manual" ? "border-primary bg-primary/5" : "border-border bg-secondary/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                  <span className="font-semibold text-foreground text-sm">Manual</span>
                </div>
                <p className="text-xs text-muted-foreground">Você toma todas as decisões. O robô aprende observando e registra padrões para evoluir.</p>
              </div>
              <div className={`p-4 rounded-lg border transition-all ${mode === "semi_auto" ? "border-warning bg-warning/5" : "border-border bg-secondary/20"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-5 h-5 text-warning" />
                  <span className="font-semibold text-foreground text-sm">Semi-Automático</span>
                </div>
                <p className="text-xs text-muted-foreground">O robô sugere operações com base no aprendizado. Você aprova ou rejeita cada decisão.</p>
              </div>
              <div className={`p-4 rounded-lg border transition-all ${mode === "auto" ? "border-profit bg-profit/5" : "border-border bg-secondary/20"} ${!canGoAuto && "opacity-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <ToggleRight className="w-5 h-5 text-profit" />
                  <span className="font-semibold text-foreground text-sm">Automático</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {canGoAuto
                    ? "O robô opera de forma autônoma usando todo o conhecimento acumulado."
                    : `Requer ${autoThreshold}% de assertividade para desbloquear.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decisions History */}
        <Tabs defaultValue="decisions">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="decisions">Histórico de Decisões</TabsTrigger>
            <TabsTrigger value="learning">Aprendizado</TabsTrigger>
          </TabsList>

          <TabsContent value="decisions" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Últimas Decisões do Cérebro</CardTitle>
              </CardHeader>
              <CardContent>
                {decisions && decisions.length > 0 ? (
                  <div className="space-y-2">
                    {decisions.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            d.outcome === "profit" ? "bg-profit/10" :
                            d.outcome === "loss" ? "bg-loss/10" :
                            d.outcome === "pending" ? "bg-warning/10" : "bg-muted"
                          }`}>
                            {d.outcome === "profit" ? <CheckCircle className="w-4 h-4 text-profit" /> :
                             d.outcome === "loss" ? <XCircle className="w-4 h-4 text-loss" /> :
                             d.outcome === "pending" ? <Clock className="w-4 h-4 text-warning" /> :
                             <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {d.decision.toUpperCase()} {d.asset}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Confiança: {parseFloat(d.confidence).toFixed(0)}% • {d.executedBy === "robot" ? "Robô" : "Humano"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {d.profitAmount && (
                            <p className={`text-sm font-bold ${parseFloat(d.profitAmount) >= 0 ? "text-profit" : "text-loss"}`}>
                              {parseFloat(d.profitAmount) >= 0 ? "+" : ""}R$ {parseFloat(d.profitAmount).toFixed(2)}
                            </p>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {d.outcome === "profit" ? "Acerto" : d.outcome === "loss" ? "Erro" : d.outcome === "pending" ? "Pendente" : "Neutro"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma decisão registrada ainda.</p>
                    <p className="text-xs text-muted-foreground mt-1">O cérebro começará a aprender com suas primeiras operações.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learning" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Padrões Aprendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium text-foreground mb-2">Melhores Horários</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">09:00 - 10:30</span>
                        <span className="text-profit">82% acerto</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">14:00 - 15:30</span>
                        <span className="text-profit">76% acerto</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">16:00 - 17:00</span>
                        <span className="text-warning">65% acerto</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium text-foreground mb-2">Padrões Favoráveis</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Tendência de alta</span>
                        <span className="text-profit">78% sucesso</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Rompimento de suporte</span>
                        <span className="text-profit">71% sucesso</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Reversão em resistência</span>
                        <span className="text-warning">62% sucesso</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium text-foreground mb-2">Ativos com Melhor Performance</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">WINFUT</span>
                        <span className="text-profit">+R$ 3.240</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">PETR4</span>
                        <span className="text-profit">+R$ 1.890</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">BTC/USD</span>
                        <span className="text-loss">-R$ 450</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium text-foreground mb-2">Evolução do Aprendizado</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Semana 1</span>
                        <span className="text-loss">45% acerto</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Semana 2</span>
                        <span className="text-warning">58% acerto</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Semana 3</span>
                        <span className="text-warning">67% acerto</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Atual</span>
                        <span className="text-profit">{assertiveness.toFixed(0)}% acerto</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
