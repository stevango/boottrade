import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlaskConical, Play, BarChart3, TrendingUp, AlertTriangle, Download, Loader2, Info } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const MARKETS = [
  { id: "indices", label: "Mini Índice" },
  { id: "dolar", label: "Mini Dólar" },
  { id: "cripto", label: "Criptomoedas" },
  { id: "forex", label: "Forex" },
  { id: "acoes", label: "Ações" },
  { id: "daytrade", label: "Day Trade" },
  { id: "apostas", label: "Apostas" },
] as const;

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type BacktestResult = {
  equityCurve: { trade: number; equity: number }[];
  finalCapital: number; totalReturn: number; maxDrawdown: number; profitFactor: number;
  expectancy: number; winRate: number; probProfit: number; probRuin: number;
  bestCase: number; worstCase: number; simulations: number; numTrades: number;
};

export default function Backtest() {
  const utils = trpc.useUtils();
  const { data: history } = trpc.backtests.list.useQuery();

  const [name, setName] = useState("");
  const [market, setMarket] = useState<string>("indices");
  const [initialCapital, setInitialCapital] = useState("10000");
  const [numTrades, setNumTrades] = useState("200");
  const [winRate, setWinRate] = useState("55");
  const [payoffRatio, setPayoffRatio] = useState("1.5");
  const [riskPerTrade, setRiskPerTrade] = useState("1");

  const [result, setResult] = useState<BacktestResult | null>(null);

  const runMutation = trpc.backtests.run.useMutation({
    onSuccess: (r) => { setResult(r); utils.backtests.list.invalidate(); toast.success("Simulação concluída!"); },
    onError: (e) => toast.error(e.message || "Falha ao executar a simulação."),
  });

  const handleRun = () => {
    const cap = parseFloat(initialCapital);
    const trades = parseInt(numTrades, 10);
    const wr = parseFloat(winRate);
    const payoff = parseFloat(payoffRatio);
    const risk = parseFloat(riskPerTrade);
    if (!name.trim()) return toast.error("Dê um nome à simulação.");
    if (!(cap > 0)) return toast.error("Capital inicial inválido.");
    if (!(trades >= 1)) return toast.error("Número de trades inválido.");
    if (!(wr >= 0 && wr <= 100)) return toast.error("Win rate deve estar entre 0 e 100.");
    if (!(payoff > 0)) return toast.error("Payoff deve ser maior que zero.");
    if (!(risk > 0 && risk <= 100)) return toast.error("Risco por trade deve estar entre 0 e 100%.");
    runMutation.mutate({
      name: name.trim(), market: market as any, initialCapital: cap,
      numTrades: trades, winRate: wr, payoffRatio: payoff, riskPerTrade: risk,
    });
  };

  const exportReport = () => {
    if (!result) return;
    const report = `# Relatório de Simulação — ${name}\n\n_Simulação Monte Carlo (${result.simulations} caminhos), não baseada em dados históricos de mercado._\n\n## Parâmetros\n- Capital inicial: R$ ${fmtBRL(parseFloat(initialCapital))}\n- Trades por caminho: ${result.numTrades}\n- Win rate: ${result.winRate.toFixed(1)}%\n- Payoff (ganho/perda): ${payoffRatio}\n- Risco por trade: ${riskPerTrade}%\n\n## Resultado (mediana dos caminhos)\n- Capital final: R$ ${fmtBRL(result.finalCapital)}\n- Retorno total: ${result.totalReturn.toFixed(1)}%\n- Max drawdown: ${result.maxDrawdown.toFixed(1)}%\n- Profit factor: ${result.profitFactor.toFixed(2)}\n- Expectância: ${result.expectancy.toFixed(3)} R/trade\n- Prob. de lucro: ${result.probProfit.toFixed(1)}%\n- Prob. de ruína (queda de 50%): ${result.probRuin.toFixed(1)}%\n- Melhor caso: R$ ${fmtBRL(result.bestCase)}\n- Pior caso: R$ ${fmtBRL(result.worstCase)}\n`;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulacao-${name.replace(/\s+/g, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Simulador de Estratégia</h1>
          <p className="text-muted-foreground">Monte Carlo a partir do edge da estratégia (win rate, payoff e risco) — sem depender de dados históricos</p>
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
                <Label className="text-sm text-muted-foreground">Nome</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Minha estratégia v1" className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Mercado</Label>
                <Select value={market} onValueChange={setMarket}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARKETS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Capital Inicial (R$)</Label>
                <Input type="number" value={initialCapital} onChange={(e) => setInitialCapital(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Nº de Trades</Label>
                  <Input type="number" value={numTrades} onChange={(e) => setNumTrades(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Win Rate (%)</Label>
                  <Input type="number" value={winRate} onChange={(e) => setWinRate(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Payoff (ganho/perda)</Label>
                  <Input type="number" step="0.1" value={payoffRatio} onChange={(e) => setPayoffRatio(e.target.value)} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Risco/Trade (%)</Label>
                  <Input type="number" step="0.1" value={riskPerTrade} onChange={(e) => setRiskPerTrade(e.target.value)} className="bg-secondary border-border" />
                </div>
              </div>

              <Button onClick={handleRun} disabled={runMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground mt-2">
                {runMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Simulando...</> : <><Play className="w-4 h-4 mr-2" /> Executar Simulação</>}
              </Button>
              {result && (
                <Button variant="outline" className="w-full mt-2" onClick={exportReport}>
                  <Download className="w-4 h-4 mr-2" /> Exportar Relatório
                </Button>
              )}

              <div className="flex items-start gap-2 p-2 rounded-lg bg-secondary/40 mt-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Resultados são uma distribuição estatística (mediana de centenas de caminhos), úteis para entender risco de drawdown e ruína — não uma previsão.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            {result ? (
              <>
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{name || "Resultado"} — curva mediana</CardTitle>
                      <Badge variant="outline" className={result.totalReturn >= 0 ? "bg-profit/10 text-profit border-profit/20" : "bg-loss/10 text-loss border-loss/20"}>
                        {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={result.equityCurve}>
                        <defs>
                          <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                        <XAxis dataKey="trade" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                        <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(1)}k`} />
                        <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }}
                          formatter={(v: number) => [`R$ ${fmtBRL(v)}`, "Capital"]} labelFormatter={(l) => `Trade ${l}`} />
                        <Area type="monotone" dataKey="equity" stroke="#00d4aa" strokeWidth={2} fill="url(#colorEquity)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Retorno (mediana)", value: `${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(1)}%`, icon: TrendingUp, color: result.totalReturn >= 0 ? "text-profit" : "text-loss" },
                    { label: "Max Drawdown", value: `${result.maxDrawdown.toFixed(1)}%`, icon: AlertTriangle, color: "text-loss" },
                    { label: "Profit Factor", value: result.profitFactor.toFixed(2), icon: FlaskConical, color: "text-primary" },
                    { label: "Expectância", value: `${result.expectancy.toFixed(2)} R`, icon: BarChart3, color: result.expectancy >= 0 ? "text-profit" : "text-loss" },
                    { label: "Prob. de Lucro", value: `${result.probProfit.toFixed(0)}%`, icon: TrendingUp, color: "text-foreground" },
                    { label: "Prob. de Ruína", value: `${result.probRuin.toFixed(0)}%`, icon: AlertTriangle, color: result.probRuin > 20 ? "text-loss" : "text-foreground" },
                    { label: "Melhor Caso", value: `R$ ${fmtBRL(result.bestCase)}`, icon: TrendingUp, color: "text-profit" },
                    { label: "Pior Caso", value: `R$ ${fmtBRL(result.worstCase)}`, icon: AlertTriangle, color: "text-loss" },
                  ].map((m) => (
                    <Card key={m.label} className="bg-card border-border">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <m.icon className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{m.label}</span>
                        </div>
                        <p className={`text-base font-bold ${m.color}`}>{m.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Card className="bg-card border-border">
                <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-2">
                  <FlaskConical className="w-10 h-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Configure os parâmetros e clique em "Executar Simulação"</p>
                  <p className="text-xs text-muted-foreground/70">O resultado mostra a distribuição de desfechos da sua estratégia.</p>
                </CardContent>
              </Card>
            )}

            {/* History */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de Simulações</CardTitle>
              </CardHeader>
              <CardContent>
                {(history ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma simulação salva ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {(history ?? []).map((bt: any) => {
                      const ret = parseFloat(String(bt.totalReturn ?? "0"));
                      return (
                        <div key={bt.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <div>
                            <p className="text-sm font-medium text-foreground">{bt.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(bt.createdAt).toLocaleDateString("pt-BR")} • {bt.totalTrades ?? 0} trades • WR {parseFloat(String(bt.winRate ?? "0")).toFixed(0)}%
                            </p>
                          </div>
                          <span className={`text-sm font-bold ${ret >= 0 ? "text-profit" : "text-loss"}`}>
                            {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
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
