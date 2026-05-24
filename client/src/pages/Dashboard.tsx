import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bot,
  Activity,
  Shield,
  AlertTriangle,
  BarChart3,
  Target,
  Wallet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

const COLORS = ["#00d4aa", "#00ff88", "#7c3aed", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];

const classLabels: Record<string, string> = {
  acoes: "Ações",
  renda_fixa: "Renda Fixa",
  fundos: "Fundos",
  cripto: "Cripto",
  cdb: "CDB",
  tesouro: "Tesouro",
  fii: "FIIs",
  internacional: "Internacional",
};

export default function Dashboard() {
  const { data: portfolio } = trpc.portfolio.list.useQuery();
  const { data: trades } = trpc.trades.list.useQuery({ limit: 10 });
  const { data: robots } = trpc.robots.list.useQuery();
  const { data: pnlData } = trpc.pnl.daily.useQuery({ days: 30 });
  const { data: goals } = trpc.goals.projections.useQuery();
  const { data: riskSettings } = trpc.risk.getSettings.useQuery();

  // All metrics below are derived from real data. When the user has no data
  // yet, values resolve to 0 / [] / null so the UI shows honest empty states
  // instead of fabricated numbers.

  const portfolioMetrics = useMemo(() => {
    if (!portfolio || portfolio.length === 0) return { totalInvested: 0, totalCurrent: 0, pnl: 0, pnlPercent: 0 };
    const totalInvested = portfolio.reduce((sum, a) => sum + parseFloat(String(a.totalInvested || "0")), 0);
    const totalCurrent = portfolio.reduce((sum, a) => sum + parseFloat(String(a.currentValue || "0")), 0);
    const pnl = totalCurrent - totalInvested;
    const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;
    return { totalInvested, totalCurrent, pnl, pnlPercent };
  }, [portfolio]);

  const allocationData = useMemo(() => {
    if (!portfolio || portfolio.length === 0) return [];
    const grouped: Record<string, number> = {};
    portfolio.forEach(a => {
      const cls = a.assetClass;
      grouped[cls] = (grouped[cls] || 0) + parseFloat(String(a.currentValue || "0"));
    });
    const total = Object.values(grouped).reduce((s, v) => s + v, 0);
    return Object.entries(grouped).map(([key, val], i) => ({
      name: classLabels[key] || key,
      value: total > 0 ? Math.round((val / total) * 100) : 0,
      color: COLORS[i % COLORS.length],
    }));
  }, [portfolio]);

  const performanceData = useMemo(() => {
    if (!pnlData || pnlData.length === 0) return [];
    let cumulative = portfolioMetrics.totalInvested;
    return [...pnlData].reverse().map(d => {
      cumulative += parseFloat(String(d.netProfit || "0"));
      return {
        date: new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        value: cumulative,
      };
    });
  }, [pnlData, portfolioMetrics]);

  const dailyResult = useMemo(() => {
    if (!pnlData || pnlData.length === 0) return { value: 0, percent: 0 };
    const today = pnlData[0];
    const net = parseFloat(String(today?.netProfit || "0"));
    const pct = portfolioMetrics.totalCurrent > 0 ? (net / portfolioMetrics.totalCurrent) * 100 : 0;
    return { value: net, percent: pct };
  }, [pnlData, portfolioMetrics]);

  const activeRobots = robots?.filter(r => r.status === "active").length || 0;

  const recentTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];
    return trades.slice(0, 5).map(t => ({
      asset: t.asset,
      type: t.type,
      profit: parseFloat(String(t.profit || "0")),
      time: new Date(t.openedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    }));
  }, [trades]);

  const winRate = useMemo(() => {
    const closed = (trades ?? []).filter(t => t.status === "closed");
    if (closed.length === 0) return null;
    const wins = closed.filter(t => parseFloat(String(t.profit || "0")) > 0).length;
    return (wins / closed.length) * 100;
  }, [trades]);

  // Period statistics derived from daily P&L rows.
  const periodStats = useMemo(() => {
    const rows = pnlData ?? [];
    const netTotal = rows.reduce((s, d) => s + parseFloat(String(d.netProfit || "0")), 0);
    const grossProfit = rows.reduce((s, d) => s + parseFloat(String(d.grossProfit || "0")), 0);
    const grossLoss = Math.abs(rows.reduce((s, d) => s + parseFloat(String(d.grossLoss || "0")), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;
    const nets = rows.map(d => parseFloat(String(d.netProfit || "0")));
    let sharpe: number | null = null;
    if (nets.length >= 2) {
      const mean = nets.reduce((a, b) => a + b, 0) / nets.length;
      const variance = nets.reduce((a, b) => a + (b - mean) ** 2, 0) / nets.length;
      const std = Math.sqrt(variance);
      sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : null;
    }
    return { netTotal, profitFactor, sharpe, hasRows: rows.length > 0 };
  }, [pnlData]);

  // Max drawdown computed from the equity curve.
  const maxDrawdown = useMemo(() => {
    if (performanceData.length === 0) return null;
    let peak = -Infinity;
    let maxDd = 0;
    for (const p of performanceData) {
      peak = Math.max(peak, p.value);
      if (peak > 0) maxDd = Math.min(maxDd, ((p.value - peak) / peak) * 100);
    }
    return maxDd;
  }, [performanceData]);

  // IA Score: average across the user's robots.
  const avgIaScore = useMemo(() => {
    const scores = (robots ?? []).map(r => parseFloat(String(r.iaScore || "0"))).filter(n => n > 0);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }, [robots]);

  const drawdownLimit = parseFloat(String(riskSettings?.maxDrawdown || "10"));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da sua performance</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Patrimônio</p>
                  <p className="text-2xl font-bold text-foreground">R$ {portfolioMetrics.totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {portfolioMetrics.pnl >= 0 ? <TrendingUp className="w-3 h-3 text-profit" /> : <TrendingDown className="w-3 h-3 text-loss" />}
                    <span className={`text-xs ${portfolioMetrics.pnl >= 0 ? "text-profit" : "text-loss"}`}>
                      {portfolioMetrics.pnl >= 0 ? "+" : ""}{portfolioMetrics.pnlPercent.toFixed(1)}% total
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Resultado Diário</p>
                  <p className={`text-2xl font-bold ${dailyResult.value >= 0 ? "text-profit" : "text-loss"}`}>
                    {dailyResult.value >= 0 ? "+" : ""}R$ {Math.abs(dailyResult.value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {dailyResult.value >= 0 ? <TrendingUp className="w-3 h-3 text-profit" /> : <TrendingDown className="w-3 h-3 text-loss" />}
                    <span className={`text-xs ${dailyResult.value >= 0 ? "text-profit" : "text-loss"}`}>
                      {dailyResult.percent >= 0 ? "+" : ""}{dailyResult.percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-profit" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Robôs Ativos</p>
                  <p className="text-2xl font-bold text-foreground">{activeRobots}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Activity className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">{robots?.length || 0} cadastrados</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Drawdown</p>
                  <p className="text-2xl font-bold text-foreground">
                    {maxDrawdown !== null ? `${maxDrawdown.toFixed(1)}%` : "—"}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Shield className="w-3 h-3 text-primary" />
                    <span className="text-xs text-muted-foreground">Limite: {drawdownLimit.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Performance</CardTitle>
                <Badge variant="secondary" className="text-xs">30 dias</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {performanceData.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-center gap-2">
                  <BarChart3 className="w-8 h-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Sem dados de performance ainda</p>
                  <p className="text-xs text-muted-foreground/70">Ative um robô ou registre operações para ver sua evolução.</p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={performanceData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                  <XAxis dataKey="date" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }}
                    labelStyle={{ color: "oklch(0.65 0.02 260)" }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Patrimônio"]}
                  />
                  <Area type="monotone" dataKey="value" stroke="#00d4aa" strokeWidth={2} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Allocation */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Alocação</CardTitle>
            </CardHeader>
            <CardContent>
              {allocationData.length === 0 ? (
                <div className="h-[180px] flex flex-col items-center justify-center text-center gap-2">
                  <Wallet className="w-8 h-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Carteira vazia</p>
                  <p className="text-xs text-muted-foreground/70">Adicione ativos para ver sua alocação.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="oklch(0.12 0.01 260)"
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {allocationData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-foreground font-medium">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Metrics */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "ROI Total", value: portfolio && portfolio.length > 0 ? `${portfolioMetrics.pnlPercent >= 0 ? "+" : ""}${portfolioMetrics.pnlPercent.toFixed(1)}%` : "—", positive: portfolioMetrics.pnl >= 0 },
                  { label: "Profit Factor", value: periodStats.profitFactor !== null ? periodStats.profitFactor.toFixed(2) : "—", positive: (periodStats.profitFactor ?? 0) >= 1 },
                  { label: "Win Rate", value: winRate !== null ? `${winRate.toFixed(1)}%` : "—", positive: (winRate ?? 0) > 50 },
                  { label: "Sharpe Ratio", value: periodStats.sharpe !== null ? periodStats.sharpe.toFixed(2) : "—", positive: (periodStats.sharpe ?? 0) > 0 },
                  { label: "Resultado (30d)", value: periodStats.hasRows ? `${periodStats.netTotal >= 0 ? "+" : ""}R$ ${periodStats.netTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "—", positive: periodStats.netTotal >= 0 },
                  { label: "IA Score", value: avgIaScore !== null ? `${avgIaScore.toFixed(1)}/10` : "—", positive: true },
                  { label: "Max Drawdown", value: maxDrawdown !== null ? `${maxDrawdown.toFixed(1)}%` : "—", positive: false },
                  { label: "Robôs Ativos", value: `${activeRobots}`, positive: true },
                ].map((metric) => (
                  <div key={metric.label} className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-xs text-muted-foreground">{metric.label}</p>
                    <p className={`text-lg font-bold ${metric.value === "—" ? "text-muted-foreground" : metric.positive ? "text-foreground" : "text-loss"}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Trades */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Operações Recentes</CardTitle>
                <Badge variant="secondary" className="text-xs">Hoje</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recentTrades.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                  <Activity className="w-8 h-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Nenhuma operação ainda</p>
                  <p className="text-xs text-muted-foreground/70">Suas operações aparecerão aqui assim que forem executadas.</p>
                </div>
              ) : (
              <div className="space-y-3">
                {recentTrades.map((trade, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.profit > 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                        {trade.profit > 0 ? (
                          <TrendingUp className="w-4 h-4 text-profit" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-loss" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                        <p className="text-xs text-muted-foreground capitalize">{trade.type === "buy" ? "Compra" : "Venda"} • {trade.time}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${trade.profit > 0 ? "text-profit" : "text-loss"}`}>
                      {trade.profit > 0 ? "+" : ""}R$ {trade.profit.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Goals Summary */}
        {goals && goals.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Metas de Patrimônio
                </CardTitle>
                <a href="/goals" className="text-xs text-primary hover:underline">Ver todas</a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {goals.slice(0, 3).map((g: any) => (
                  <div key={g.id} className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium text-foreground truncate">{g.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">
                        R$ {parseFloat(String(g.currentAmount || "0")).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} / R$ {parseFloat(String(g.targetAmount || "0")).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
                      </span>
                      <span className="text-xs text-primary font-medium">{g.progress?.toFixed(0) || 0}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-secondary rounded-full mt-2">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(g.progress || 0, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
