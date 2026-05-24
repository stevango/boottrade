import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, BarChart3, Target, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function PnL() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");

  const { data: aggregated, isLoading } = trpc.pnl.aggregated.useQuery({ period });
  const { data: daily } = trpc.pnl.daily.useQuery({ days: period === "week" ? 7 : period === "month" ? 30 : 365 });

  const chartData = (daily || []).reverse().map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    netProfit: parseFloat(String(d.netProfit || "0")),
    grossProfit: parseFloat(String(d.grossProfit || "0")),
    grossLoss: parseFloat(String(d.grossLoss || "0")),
    trades: d.totalTrades || 0,
  }));

  const cumulativeData = chartData.reduce((acc: any[], item, i) => {
    const prev = i > 0 ? acc[i - 1].cumulative : 0;
    acc.push({ ...item, cumulative: prev + item.netProfit });
    return acc;
  }, []);

  const totalNet = aggregated?.totalNetProfit || 0;
  const totalTrades = aggregated?.totalTrades || 0;
  const winRate = aggregated?.winRate || 0;
  const avgPerTrade = totalTrades > 0 ? totalNet / totalTrades : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-primary" />
              P&L Detalhado
            </h1>
            <p className="text-muted-foreground">Controle de ganhos e perdas por período</p>
          </div>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList className="bg-secondary">
              <TabsTrigger value="week">7 dias</TabsTrigger>
              <TabsTrigger value="month">30 dias</TabsTrigger>
              <TabsTrigger value="all">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalNet >= 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                  {totalNet >= 0 ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Resultado Líquido</p>
                  <p className={`text-lg font-bold ${totalNet >= 0 ? "text-profit" : "text-loss"}`}>
                    {totalNet >= 0 ? "+" : ""}R$ {totalNet.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Trades</p>
                  <p className="text-lg font-bold text-foreground">{totalTrades}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-profit" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-lg font-bold text-profit">{winRate.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${avgPerTrade >= 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Média/Trade</p>
                  <p className={`text-lg font-bold ${avgPerTrade >= 0 ? "text-profit" : "text-loss"}`}>
                    R$ {avgPerTrade.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resultado Acumulado</CardTitle>
            </CardHeader>
            <CardContent>
              {cumulativeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={cumulativeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Nenhum dado de P&L disponível para o período.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">P&L Diário</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="netProfit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">Nenhum dado de P&L disponível para o período.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily breakdown table */}
        {chartData.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhamento por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium">Data</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Trades</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Lucro Bruto</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Perda Bruta</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.slice(-10).reverse().map((d, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 text-foreground">{d.date}</td>
                        <td className="py-2 text-right text-foreground">{d.trades}</td>
                        <td className="py-2 text-right text-profit">+R$ {d.grossProfit.toFixed(2)}</td>
                        <td className="py-2 text-right text-loss">-R$ {Math.abs(d.grossLoss).toFixed(2)}</td>
                        <td className={`py-2 text-right font-medium ${d.netProfit >= 0 ? "text-profit" : "text-loss"}`}>
                          {d.netProfit >= 0 ? "+" : ""}R$ {d.netProfit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
