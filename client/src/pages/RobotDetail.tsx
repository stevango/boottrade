import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Brain, TrendingUp, TrendingDown, Shield, ArrowLeft, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

const marketLabels: Record<string, string> = {
  dolar: "Dólar", acoes: "Ações", daytrade: "Day Trade", cripto: "Cripto",
  apostas: "Apostas", forex: "Forex", indices: "Índices",
};

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-profit/10 text-profit border-profit/20" },
  paused: { label: "Pausado", className: "bg-warning/10 text-warning border-warning/20" },
  testing: { label: "Em teste", className: "bg-primary/10 text-primary border-primary/20" },
  archived: { label: "Arquivado", className: "bg-secondary text-muted-foreground border-border" },
};

const num = (v: unknown) => parseFloat(String(v ?? "0"));
const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[350px] flex flex-col items-center justify-center text-center gap-2">
      <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

export default function RobotDetail() {
  const params = useParams();
  const id = Number(params.id);

  const { data: robot, isLoading } = trpc.robots.getById.useQuery({ id }, { enabled: Number.isFinite(id) });
  const { data: trades } = trpc.robots.trades.useQuery({ robotId: id }, { enabled: Number.isFinite(id) });
  const { data: risk } = trpc.risk.getSettings.useQuery();

  const closedTrades = useMemo(
    () => (trades ?? []).filter(t => t.status === "closed" && t.closedAt),
    [trades],
  );

  // Equity curve: cumulative realized P&L over closed trades (chronological).
  const performanceData = useMemo(() => {
    const sorted = [...closedTrades].sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
    if (sorted.length === 0) return [];
    let cumulative = 0;
    return [{ idx: 0, value: 0 }, ...sorted.map((t, i) => {
      cumulative += num(t.profit);
      return { idx: i + 1, value: cumulative };
    })];
  }, [closedTrades]);

  // Monthly net result (R$) grouped by month.
  const monthlyData = useMemo(() => {
    const buckets: Record<string, number> = {};
    closedTrades.forEach(t => {
      const d = new Date(t.closedAt!);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      buckets[key] = (buckets[key] || 0) + num(t.profit);
    });
    return Object.entries(buckets).map(([month, value]) => ({ month, value }));
  }, [closedTrades]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!robot) {
    return (
      <AppLayout>
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
          <Bot className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-foreground font-medium">Robô não encontrado</p>
          <Link href="/robots">
            <Button variant="outline" className="border-border"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar para Robôs</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const status = statusLabels[robot.status] ?? statusLabels.paused;
  const totalReturn = num(robot.totalReturn);
  const monthlyReturn = num(robot.monthlyReturn);
  const drawdown = num(robot.drawdown);

  const kpis = [
    { label: "Win Rate", value: `${num(robot.winRate).toFixed(1)}%`, color: "text-profit" },
    { label: "Retorno Total", value: `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`, color: totalReturn >= 0 ? "text-profit" : "text-loss" },
    { label: "Drawdown", value: `${drawdown.toFixed(1)}%`, color: "text-loss" },
    { label: "Profit Factor", value: num(robot.profitFactor).toFixed(2), color: "text-foreground" },
    { label: "Total Trades", value: (robot.totalTrades ?? 0).toLocaleString("pt-BR"), color: "text-foreground" },
    { label: "Mensal", value: `${monthlyReturn >= 0 ? "+" : ""}${monthlyReturn.toFixed(1)}%`, color: monthlyReturn >= 0 ? "text-profit" : "text-loss" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/robots">
            <Button variant="outline" size="sm" className="border-border">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{robot.name}</h1>
                <Badge variant="outline" className={status.className}>{status.label}</Badge>
              </div>
              <p className="text-muted-foreground">
                {marketLabels[robot.market] ?? robot.market} • IA Score: {num(robot.iaScore).toFixed(1)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/robots/${robot.id}/brain`}>
              <Button variant="outline" className="border-border">
                <Brain className="w-4 h-4 mr-2" /> Cérebro
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {robot.description && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{robot.description}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="performance">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="monthly">Mensal</TabsTrigger>
            <TabsTrigger value="trades">Operações</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">P&L acumulado (operações fechadas)</CardTitle>
              </CardHeader>
              <CardContent>
                {performanceData.length === 0 ? (
                  <EmptyChart>Sem operações fechadas neste robô ainda.</EmptyChart>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                      <XAxis dataKey="idx" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                      <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }}
                        formatter={(value: number) => [`R$ ${fmtBRL(value)}`, "P&L acumulado"]}
                      />
                      <Area type="monotone" dataKey="value" stroke="#00d4aa" strokeWidth={2} fill="url(#colorPerf)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resultado mensal (R$)</CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyData.length === 0 ? (
                  <EmptyChart>Sem resultados mensais ainda.</EmptyChart>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                      <XAxis dataKey="month" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                      <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }}
                        formatter={(value: number) => [`R$ ${fmtBRL(value)}`, "Resultado"]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {monthlyData.map((d, i) => (
                          <Cell key={i} fill={d.value >= 0 ? "#00d4aa" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Últimas Operações</CardTitle>
              </CardHeader>
              <CardContent>
                {(trades ?? []).length === 0 ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                    <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Nenhuma operação registrada para este robô.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(trades ?? []).map((trade) => {
                      const profit = num(trade.profit);
                      const isOpen = trade.status === "open";
                      return (
                        <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? "bg-primary/10" : profit > 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                              {profit >= 0 ? <TrendingUp className="w-4 h-4 text-profit" /> : <TrendingDown className="w-4 h-4 text-loss" />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                              <p className="text-xs text-muted-foreground">
                                {trade.type === "buy" ? "Compra" : "Venda"} • {new Date(trade.openedAt).toLocaleString("pt-BR")}
                              </p>
                            </div>
                          </div>
                          {isOpen ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Aberta</Badge>
                          ) : (
                            <span className={`text-sm font-bold ${profit > 0 ? "text-profit" : "text-loss"}`}>
                              {profit > 0 ? "+" : ""}R$ {fmtBRL(profit)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gestão de Risco</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Seus limites de risco</h3>
                    {[
                      { label: "Stop Loss", value: risk ? `${num(risk.defaultStopLoss).toFixed(1)}%` : "—" },
                      { label: "Take Profit", value: risk ? `${num(risk.defaultTakeProfit).toFixed(1)}%` : "—" },
                      { label: "Max Drawdown", value: risk ? `${num(risk.maxDrawdown).toFixed(1)}%` : "—" },
                      { label: "Perda Diária Máx.", value: risk ? `R$ ${fmtBRL(num(risk.maxDailyLoss))}` : "—" },
                      { label: "Posições Simultâneas", value: risk ? String(risk.maxOpenPositions ?? "—") : "—" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                    <Link href="/risk">
                      <Button variant="outline" size="sm" className="border-border w-full">Ajustar gestão de risco</Button>
                    </Link>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Bot className="w-4 h-4 text-primary" /> Estratégia</h3>
                    <div className="p-3 rounded-lg bg-secondary/30">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {robot.strategy || "Nenhuma estratégia documentada para este robô."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <span className="text-sm text-muted-foreground">Nível de risco</span>
                      <span className="text-sm font-medium text-foreground capitalize">{robot.riskLevel}</span>
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
