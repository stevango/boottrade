import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon, Newspaper, Bell, BellRing, Clock, Activity,
  TrendingUp, TrendingDown, Minus, Search, Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TrendSignal = {
  lastPrice: number; trend: "alta" | "baixa" | "lateral"; trendStrength: number;
  returns: { label: string; days: number; percent: number | null }[];
  sma50: number | null; sma200: number | null; maxDrawdown: number;
  annualizedVolatility: number | null; summary: string;
};

const trendStyle = {
  alta: { label: "Alta", className: "bg-profit/10 text-profit border-profit/20", Icon: TrendingUp },
  baixa: { label: "Baixa", className: "bg-loss/10 text-loss border-loss/20", Icon: TrendingDown },
  lateral: { label: "Lateral", className: "bg-secondary text-muted-foreground border-border", Icon: Minus },
};

function MarketTrend() {
  const [symbol, setSymbol] = useState("PETR4");
  const [range, setRange] = useState<"1y" | "5y" | "10y">("5y");
  const [result, setResult] = useState<{ configured: boolean; symbol: string; name: string; signal: TrendSignal | null; message: string | null } | null>(null);

  const analyze = trpc.market.analyze.useMutation({
    onSuccess: (r) => setResult(r as any),
    onError: () => toast.error("Falha ao analisar. Verifique o código do ativo."),
  });

  const run = () => {
    if (!symbol.trim()) return toast.error("Informe o código do ativo (ex.: PETR4).");
    analyze.mutate({ symbol: symbol.trim(), range });
  };

  const sig = result?.signal;
  const t = sig ? trendStyle[sig.trend] : null;

  return (
    <div className="space-y-4">
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Ativo</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="PETR4, VALE3, IVVB11..." className="bg-secondary border-border" onKeyDown={(e) => e.key === "Enter" && run()} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Período</Label>
              <div className="flex gap-1">
                {(["1y", "5y", "10y"] as const).map(r => (
                  <button key={r} onClick={() => setRange(r)} className={`px-3 py-2 rounded-lg text-xs border transition-all ${range === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"}`}>{r === "1y" ? "1A" : r === "5y" ? "5A" : "10A"}</button>
                ))}
              </div>
            </div>
            <Button onClick={run} disabled={analyze.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {analyze.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />} Analisar
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && result.configured === false && (
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Feed de mercado não configurado</p>
              <p className="text-xs text-muted-foreground mt-1">Defina <code className="text-primary">BRAPI_TOKEN</code> no servidor (token gratuito em brapi.dev) para ativar a análise de tendências com dados reais.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {result && result.configured && !sig && (
        <Card className="bg-card border-border"><CardContent className="p-6 text-center text-sm text-muted-foreground">{result.message || "Sem dados para este ativo."}</CardContent></Card>
      )}

      {sig && t && (
        <>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{result?.name} <span className="text-xs text-muted-foreground">({result?.symbol})</span></p>
                  <p className="text-2xl font-bold text-foreground">R$ {sig.lastPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <Badge variant="outline" className={t.className}>
                  <t.Icon className="w-3 h-3 mr-1" /> Tendência de {t.label} • força {sig.trendStrength}%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{sig.summary}</p>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sig.returns.map((r) => (
              <Card key={r.label} className="bg-card border-border">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Retorno {r.label}</p>
                  <p className={`text-lg font-bold ${r.percent === null ? "text-muted-foreground" : r.percent >= 0 ? "text-profit" : "text-loss"}`}>
                    {r.percent === null ? "—" : `${r.percent >= 0 ? "+" : ""}${r.percent.toFixed(1)}%`}
                  </p>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Drawdown máx.</p><p className="text-lg font-bold text-loss">{sig.maxDrawdown.toFixed(1)}%</p></CardContent></Card>
            {sig.annualizedVolatility !== null && (
              <Card className="bg-card border-border"><CardContent className="p-3"><p className="text-xs text-muted-foreground">Volatilidade anual</p><p className="text-lg font-bold text-foreground">{sig.annualizedVolatility.toFixed(1)}%</p></CardContent></Card>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">Análise descritiva baseada em dados históricos — não é previsão nem recomendação de compra/venda.</p>
        </>
      )}
    </div>
  );
}

const alertConfigs = [
  { id: "price_spike", label: "Variação brusca de preço (>3%)", description: "Alerta quando um ativo da sua carteira varia mais de 3% em curto período", enabled: true },
  { id: "volume_surge", label: "Volume anormal", description: "Detecta quando o volume de negociação está 200% acima da média", enabled: true },
  { id: "economic_event", label: "Eventos econômicos de alto impacto", description: "Notifica 30min antes de eventos econômicos importantes", enabled: true },
  { id: "stop_triggered", label: "Stop Loss atingido", description: "Alerta imediato quando um stop loss é acionado", enabled: true },
  { id: "target_reached", label: "Meta de preço atingida", description: "Notifica quando um ativo atinge o preço-alvo definido", enabled: false },
  { id: "trend_reversal", label: "Reversão de tendência", description: "IA detecta possível reversão de tendência em ativos monitorados", enabled: false },
  { id: "news_impact", label: "Notícias de alto impacto", description: "Alerta quando notícias relevantes podem afetar seus ativos", enabled: true },
  { id: "drawdown_alert", label: "Drawdown acima do limite", description: "Notifica quando o drawdown da carteira ultrapassa o limite configurado", enabled: true },
];

function ComingSoon({ icon: Icon, title, desc }: { icon: typeof Activity; title: string; desc: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <p className="text-foreground font-medium">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{desc}</p>
        <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" /> Em breve</Badge>
      </CardContent>
    </Card>
  );
}

export default function Calendar() {
  const [alerts, setAlerts] = useState(alertConfigs);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    toast.success("Preferência de alerta atualizada");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário, Mercado & Alertas</h1>
          <p className="text-muted-foreground">Eventos econômicos, dados de mercado e preferências de alerta</p>
        </div>

        <Tabs defaultValue="alerts">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="market"><Activity className="w-3.5 h-3.5 mr-1.5" /> Mercado</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarIcon className="w-3.5 h-3.5 mr-1.5" /> Calendário</TabsTrigger>
            <TabsTrigger value="news"><Newspaper className="w-3.5 h-3.5 mr-1.5" /> Notícias</TabsTrigger>
            <TabsTrigger value="alerts"><Bell className="w-3.5 h-3.5 mr-1.5" /> Alertas</TabsTrigger>
          </TabsList>

          <TabsContent value="market" className="mt-6">
            <MarketTrend />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <ComingSoon
              icon={CalendarIcon}
              title="Calendário econômico"
              desc="Eventos macroeconômicos (PIB, decisões de juros, payroll) virão de um provedor de calendário econômico, com previsão, valor anterior e resultado."
            />
          </TabsContent>

          <TabsContent value="news" className="mt-6">
            <ComingSoon
              icon={Newspaper}
              title="Feed de notícias"
              desc="Manchetes financeiras em tempo real, classificadas por impacto, dependem de um feed de notícias integrado."
            />
          </TabsContent>

          {/* Alerts Configuration — real local preferences */}
          <TabsContent value="alerts" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-primary" /> Preferências de Alerta
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/40 mb-4">
                    <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Escolha quais alertas deseja receber. A <strong>entrega em tempo real</strong> depende do monitor de mercado, que será ativado junto com o feed de dados (em breve).
                    </p>
                  </div>
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-foreground cursor-pointer">{alert.label}</Label>
                            {alert.enabled && (
                              <Badge variant="outline" className="text-[10px] border-profit/30 text-profit">Ativo</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                        </div>
                        <Switch checked={alert.enabled} onCheckedChange={() => toggleAlert(alert.id)} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" /> Alertas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
                    <Bell className="w-8 h-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Nenhum alerta ainda</p>
                    <p className="text-xs text-muted-foreground/70">Os alertas disparados aparecerão aqui quando o monitor estiver ativo.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
