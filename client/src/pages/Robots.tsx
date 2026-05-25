import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Play, Pause, Shield, Zap, Eye, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const marketLabels: Record<string, string> = {
  dolar: "Mini Dólar", acoes: "Ações", daytrade: "Day Trade", cripto: "Criptomoedas",
  apostas: "Apostas", forex: "Forex", indices: "Mini Índice",
};
const riskConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Baixo", color: "text-profit" }, medium: { label: "Médio", color: "text-warning" },
  high: { label: "Alto", color: "text-loss" }, extreme: { label: "Extremo", color: "text-loss" },
};
const num = (v: unknown) => parseFloat(String(v ?? "0"));

export default function Robots() {
  const [activeTab, setActiveTab] = useState("all");
  const utils = trpc.useUtils();
  const { data: robots, isLoading } = trpc.robots.list.useQuery();
  const { data: myStatuses } = trpc.robots.myStatuses.useQuery();

  const setStatus = trpc.robots.setStatus.useMutation({
    onSuccess: (r) => { toast.success(r.status === "active" ? "Robô ativado!" : "Robô pausado."); utils.robots.myStatuses.invalidate(); },
    onError: () => toast.error("Não foi possível alterar o robô."),
  });

  const statusMap = new Map((myStatuses ?? []).map((s: any) => [s.robotId, s.status]));
  const isActive = (id: number) => statusMap.get(id) === "active";

  const list = robots ?? [];
  const filtered = activeTab === "all" ? list : list.filter((r: any) => r.market === activeTab);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Robôs</h1>
          <p className="text-muted-foreground">Ative os robôs que deseja acompanhar e gerencie seu cérebro evolutivo</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary border border-border flex-wrap h-auto">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="dolar">Dólar</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
            <TabsTrigger value="daytrade">Day Trade</TabsTrigger>
            <TabsTrigger value="cripto">Cripto</TabsTrigger>
            <TabsTrigger value="forex">Forex</TabsTrigger>
            <TabsTrigger value="apostas">Apostas</TabsTrigger>
            <TabsTrigger value="indices">Índices</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {isLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-2">
                <Bot className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum robô neste mercado.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((robot: any) => {
                  const active = isActive(robot.id);
                  const adopted = statusMap.has(robot.id);
                  return (
                    <Card key={robot.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300 group">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <Bot className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{robot.name}</p>
                              <p className="text-xs text-muted-foreground">{marketLabels[robot.market] || robot.market}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={adopted ? (active ? "bg-profit/10 text-profit border-profit/20" : "bg-warning/10 text-warning border-warning/20") : "bg-muted text-muted-foreground border-border"}>
                            {adopted ? (active ? "Ativo" : "Pausado") : "Disponível"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="p-2 rounded-md bg-secondary/50"><p className="text-xs text-muted-foreground">Win Rate</p><p className="text-sm font-bold text-foreground">{num(robot.winRate).toFixed(1)}%</p></div>
                          <div className="p-2 rounded-md bg-secondary/50"><p className="text-xs text-muted-foreground">Retorno</p><p className="text-sm font-bold text-profit">+{num(robot.totalReturn).toFixed(1)}%</p></div>
                          <div className="p-2 rounded-md bg-secondary/50"><p className="text-xs text-muted-foreground">Drawdown</p><p className="text-sm font-bold text-loss">-{num(robot.drawdown).toFixed(1)}%</p></div>
                          <div className="p-2 rounded-md bg-secondary/50"><p className="text-xs text-muted-foreground">IA Score</p><p className="text-sm font-bold text-primary">{num(robot.iaScore).toFixed(1)}</p></div>
                        </div>

                        <div className="flex items-center justify-between text-xs mb-4">
                          <div className="flex items-center gap-1">
                            <Shield className="w-3 h-3" /><span className="text-muted-foreground">Risco:</span>
                            <span className={riskConfig[robot.riskLevel]?.color}>{riskConfig[robot.riskLevel]?.label ?? robot.riskLevel}</span>
                          </div>
                          <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-primary" /><span className="text-muted-foreground">PF: {num(robot.profitFactor).toFixed(2)}</span></div>
                        </div>

                        <div className="flex gap-2">
                          <Link href={`/robots/${robot.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full border-border hover:bg-secondary"><Eye className="w-3 h-3 mr-1" /> Detalhes</Button>
                          </Link>
                          <Button
                            variant="outline" size="sm"
                            disabled={setStatus.isPending}
                            onClick={() => setStatus.mutate({ robotId: robot.id, status: active ? "paused" : "active" })}
                            className={active ? "border-warning/30 text-warning hover:bg-warning/10" : "border-profit/30 text-profit hover:bg-profit/10"}
                          >
                            {active ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
