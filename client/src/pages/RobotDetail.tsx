import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Play, Pause, Settings, TrendingUp, Shield, ArrowLeft } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Link } from "wouter";

const performanceData = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  value: 10000 + Math.random() * 3000 + i * 80,
  profit: (Math.random() - 0.3) * 500,
}));

const monthlyData = [
  { month: "Jan", return: 4.2 },
  { month: "Fev", return: 3.8 },
  { month: "Mar", return: -1.2 },
  { month: "Abr", return: 5.1 },
  { month: "Mai", return: 2.9 },
  { month: "Jun", return: 4.5 },
];

export default function RobotDetail() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Back & Header */}
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
                <h1 className="text-2xl font-bold text-foreground">Athena AI</h1>
                <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20">Ativo</Badge>
              </div>
              <p className="text-muted-foreground">Especialista em Mini Índice • IA Score: 9.2</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border">
              <Settings className="w-4 h-4 mr-2" /> Configurar
            </Button>
            <Button variant="outline" className="border-warning/30 text-warning hover:bg-warning/10">
              <Pause className="w-4 h-4 mr-2" /> Pausar
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Win Rate", value: "82.5%", color: "text-profit" },
            { label: "Retorno Total", value: "+18.5%", color: "text-profit" },
            { label: "Drawdown", value: "-3.2%", color: "text-loss" },
            { label: "Profit Factor", value: "2.45", color: "text-foreground" },
            { label: "Total Trades", value: "1,247", color: "text-foreground" },
            { label: "Mensal", value: "+4.8%", color: "text-profit" },
          ].map((kpi) => (
            <Card key={kpi.label} className="bg-card border-border">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
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
                <CardTitle className="text-base">Evolução Patrimonial (30 dias)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                    <XAxis dataKey="day" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                    <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                    <Area type="monotone" dataKey="value" stroke="#00d4aa" strokeWidth={2} fill="url(#colorPerf)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Retorno Mensal (%)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                    <XAxis dataKey="month" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                    <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                    <Bar dataKey="return" fill="#00d4aa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trades" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Últimas Operações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from({ length: 8 }, (_, i) => ({
                    asset: "WINFUT",
                    type: Math.random() > 0.3 ? "buy" : "sell",
                    profit: (Math.random() - 0.3) * 800,
                    date: `${24 - i}/05/2026`,
                    time: `${9 + Math.floor(Math.random() * 8)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
                  })).map((trade, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.profit > 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                          <TrendingUp className={`w-4 h-4 ${trade.profit > 0 ? "text-profit" : "text-loss"}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                          <p className="text-xs text-muted-foreground">{trade.type === "buy" ? "Compra" : "Venda"} • {trade.date} {trade.time}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${trade.profit > 0 ? "text-profit" : "text-loss"}`}>
                        {trade.profit > 0 ? "+" : ""}R$ {trade.profit.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Configuração do Robô</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Gestão de Risco</h3>
                    {[
                      { label: "Stop Loss", value: "2.0%" },
                      { label: "Take Profit", value: "4.0%" },
                      { label: "Max Drawdown", value: "10.0%" },
                      { label: "Perda Diária Máx.", value: "R$ 500" },
                      { label: "Posições Simultâneas", value: "3" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /> Parâmetros</h3>
                    {[
                      { label: "Timeframe", value: "5 min" },
                      { label: "Indicadores", value: "RSI, MACD, EMA" },
                      { label: "Horário Operação", value: "09:00 - 17:00" },
                      { label: "Alavancagem", value: "5x" },
                      { label: "Modo", value: "Agressivo" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className="text-sm font-medium text-foreground">{item.value}</span>
                      </div>
                    ))}
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
