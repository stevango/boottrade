import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Play, BarChart3, TrendingUp, AlertTriangle, Download, FileText } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

const backtestResult = Array.from({ length: 60 }, (_, i) => ({
  day: i + 1,
  equity: 10000 + (Math.random() * 200 + 50) * i - Math.random() * 500,
  benchmark: 10000 + 30 * i,
}));

const completedBacktests = [
  { id: 1, name: "Athena v2 - Mini Índice", status: "completed", return: 22.4, drawdown: 4.1, winRate: 79.3, trades: 342, date: "20/05/2026" },
  { id: 2, name: "Kraken - BTC Scalping", status: "completed", return: 18.7, drawdown: 7.2, winRate: 72.1, trades: 189, date: "18/05/2026" },
  { id: 3, name: "Odin - EUR/USD Swing", status: "completed", return: -3.2, drawdown: 8.5, winRate: 55.4, trades: 87, date: "15/05/2026" },
  { id: 4, name: "Titan - PETR4 Day Trade", status: "running", return: 0, drawdown: 0, winRate: 0, trades: 0, date: "24/05/2026" },
];

export default function Backtest() {
  const [showResult, setShowResult] = useState(true);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Backtest Engine</h1>
          <p className="text-muted-foreground">Simule estratégias com dados históricos reais</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Config Panel */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-primary" /> Nova Simulação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Robô</Label>
                <Select defaultValue="athena">
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="athena">Athena AI</SelectItem>
                    <SelectItem value="kraken">Kraken AI</SelectItem>
                    <SelectItem value="odin">Odin AI</SelectItem>
                    <SelectItem value="titan">Titan AI</SelectItem>
                    <SelectItem value="quantum">Quantum AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Mercado</Label>
                <Select defaultValue="indices">
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="indices">Mini Índice</SelectItem>
                    <SelectItem value="dolar">Mini Dólar</SelectItem>
                    <SelectItem value="cripto">Criptomoedas</SelectItem>
                    <SelectItem value="forex">Forex</SelectItem>
                    <SelectItem value="acoes">Ações</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Data Início</Label>
                  <Input type="date" defaultValue="2025-01-01" className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Data Fim</Label>
                  <Input type="date" defaultValue="2025-12-31" className="bg-secondary border-border" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Capital Inicial</Label>
                <Input type="number" defaultValue="10000" className="bg-secondary border-border" />
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Timeframe</Label>
                <Select defaultValue="5m">
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 minuto</SelectItem>
                    <SelectItem value="5m">5 minutos</SelectItem>
                    <SelectItem value="15m">15 minutos</SelectItem>
                    <SelectItem value="1h">1 hora</SelectItem>
                    <SelectItem value="1d">Diário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2">
                <Play className="w-4 h-4 mr-2" /> Executar Backtest
              </Button>

              {showResult && (
                <Button variant="outline" className="w-full mt-2" onClick={() => {
                  // Generate and download report
                  const report = `# Relatório de Backtest - Athena v2\n\n## Resumo\n- **Retorno Total:** +22.4%\n- **Max Drawdown:** -4.1%\n- **Win Rate:** 79.3%\n- **Profit Factor:** 2.67\n- **Total de Trades:** 342\n- **Período:** 01/01/2025 - 31/12/2025\n- **Capital Inicial:** R$ 10.000\n- **Capital Final:** R$ 12.240\n\n## Métricas Detalhadas\n- **Sharpe Ratio:** 1.85\n- **Sortino Ratio:** 2.41\n- **Calmar Ratio:** 5.46\n- **Média de Ganho:** R$ 127,50\n- **Média de Perda:** -R$ 67,30\n- **Maior Ganho:** R$ 890,00\n- **Maior Perda:** -R$ 320,00\n- **Tempo Médio por Trade:** 2h 15min\n- **Trades por Dia (média):** 1.4\n\n## Análise de Risco\n- **VaR (95%):** -R$ 245,00\n- **Expected Shortfall:** -R$ 380,00\n- **Drawdown Máximo:** -4.1% (durou 8 dias)\n- **Recovery Time:** 12 dias\n\n## Distribuição por Horário\n- 09:00-10:00: 45% dos trades (melhor performance)\n- 10:00-12:00: 30% dos trades\n- 14:00-17:00: 25% dos trades\n\n## Conclusão\nA estratégia apresentou resultados consistentes com baixo drawdown e alto win rate. Recomendado para operação em modo semi-automático.`;
                  const blob = new Blob([report], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "backtest-report-athena-v2.md";
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-4 h-4 mr-2" /> Exportar Relatório
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {showResult && (
              <>
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Resultado: Athena v2 - Mini Índice</CardTitle>
                      <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20">+22.4%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={backtestResult}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                        <XAxis dataKey="day" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                        <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(1)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                        <Area type="monotone" dataKey="equity" stroke="#00d4aa" strokeWidth={2} fill="url(#colorEquity)" name="Estratégia" />
                        <Area type="monotone" dataKey="benchmark" stroke="oklch(0.65 0.02 260)" strokeWidth={1} strokeDasharray="5 5" fill="none" name="Benchmark" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Detailed Report */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" /> Relatório Detalhado
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Sharpe Ratio</p>
                        <p className="font-bold text-foreground">1.85</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Sortino Ratio</p>
                        <p className="font-bold text-foreground">2.41</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Calmar Ratio</p>
                        <p className="font-bold text-foreground">5.46</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Média Ganho</p>
                        <p className="font-bold text-profit">R$ 127,50</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Média Perda</p>
                        <p className="font-bold text-loss">-R$ 67,30</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">VaR (95%)</p>
                        <p className="font-bold text-warning">-R$ 245</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Trades/Dia</p>
                        <p className="font-bold text-foreground">1.4</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Tempo Méd/Trade</p>
                        <p className="font-bold text-foreground">2h 15min</p>
                      </div>
                      <div className="p-2 rounded bg-secondary/30">
                        <p className="text-xs text-muted-foreground">Recovery Time</p>
                        <p className="font-bold text-foreground">12 dias</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Retorno Total", value: "+22.4%", icon: TrendingUp, color: "text-profit" },
                    { label: "Max Drawdown", value: "-4.1%", icon: AlertTriangle, color: "text-loss" },
                    { label: "Win Rate", value: "79.3%", icon: BarChart3, color: "text-foreground" },
                    { label: "Profit Factor", value: "2.67", icon: FlaskConical, color: "text-primary" },
                  ].map((m) => (
                    <Card key={m.label} className="bg-card border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <m.icon className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{m.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* History */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de Backtests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {completedBacktests.map((bt) => (
                    <div key={bt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div>
                        <p className="text-sm font-medium text-foreground">{bt.name}</p>
                        <p className="text-xs text-muted-foreground">{bt.date} • {bt.trades} trades</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {bt.status === "running" ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Executando...</Badge>
                        ) : (
                          <span className={`text-sm font-bold ${bt.return > 0 ? "text-profit" : "text-loss"}`}>
                            {bt.return > 0 ? "+" : ""}{bt.return}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
