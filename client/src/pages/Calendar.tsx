import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon, Newspaper, AlertTriangle, TrendingUp, TrendingDown,
  Globe, Clock, Bell, BellRing, ArrowUpRight, ArrowDownRight, Activity, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const economicEvents = [
  { id: 1, time: "09:00", event: "PIB Brasil (Trimestral)", country: "BR", impact: "high", forecast: "2.1%", previous: "1.8%", actual: "2.3%" },
  { id: 2, time: "10:30", event: "Taxa de Desemprego", country: "BR", impact: "medium", forecast: "7.8%", previous: "8.1%", actual: null },
  { id: 3, time: "14:30", event: "Non-Farm Payrolls", country: "US", impact: "high", forecast: "180K", previous: "175K", actual: null },
  { id: 4, time: "15:00", event: "Decisão Taxa de Juros Fed", country: "US", impact: "high", forecast: "5.25%", previous: "5.25%", actual: null },
  { id: 5, time: "16:00", event: "Balança Comercial", country: "BR", impact: "low", forecast: "$8.2B", previous: "$7.5B", actual: null },
  { id: 6, time: "20:00", event: "PMI Manufatura China", country: "CN", impact: "medium", forecast: "50.2", previous: "49.8", actual: null },
];

const news = [
  { id: 1, title: "Fed mantém taxa de juros e sinaliza possível corte em setembro", source: "Reuters", time: "há 30 min", category: "Macro", impact: "high" },
  { id: 2, title: "Bitcoin ultrapassa US$ 70.000 após aprovação de ETF spot", source: "Bloomberg", time: "há 1h", category: "Cripto", impact: "high" },
  { id: 3, title: "Ibovespa renova máxima histórica com fluxo estrangeiro", source: "InfoMoney", time: "há 2h", category: "Ações", impact: "medium" },
  { id: 4, title: "Dólar recua para R$ 5,05 com dados positivos do PIB", source: "Valor", time: "há 3h", category: "Câmbio", impact: "medium" },
  { id: 5, title: "Petrobras anuncia dividendos extraordinários de R$ 15 bi", source: "Exame", time: "há 4h", category: "Ações", impact: "medium" },
  { id: 6, title: "Banco Central sinaliza fim do ciclo de alta da Selic", source: "Folha", time: "há 5h", category: "Macro", impact: "high" },
];

// Simulated real-time market data
const initialMarketData = [
  { symbol: "IBOV", name: "Ibovespa", price: 132450.00, change: 1.23, volume: "12.4B" },
  { symbol: "PETR4", name: "Petrobras PN", price: 38.72, change: 2.15, volume: "890M" },
  { symbol: "VALE3", name: "Vale ON", price: 68.45, change: -0.87, volume: "1.2B" },
  { symbol: "ITUB4", name: "Itaú PN", price: 32.18, change: 0.45, volume: "650M" },
  { symbol: "BTC/USD", name: "Bitcoin", price: 71250.00, change: 3.42, volume: "45.2B" },
  { symbol: "ETH/USD", name: "Ethereum", price: 3850.00, change: 2.18, volume: "18.7B" },
  { symbol: "USD/BRL", name: "Dólar", price: 5.05, change: -0.32, volume: "8.9B" },
  { symbol: "EUR/BRL", name: "Euro", price: 5.48, change: -0.15, volume: "3.2B" },
  { symbol: "S&P500", name: "S&P 500", price: 5320.00, change: 0.67, volume: "28.1B" },
  { symbol: "NASDAQ", name: "Nasdaq", price: 16890.00, change: 1.05, volume: "22.3B" },
];

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

const impactColors = {
  high: "bg-loss/10 text-loss border-loss/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-muted text-muted-foreground border-border",
};

export default function Calendar() {
  const [marketData, setMarketData] = useState(initialMarketData);
  const [alerts, setAlerts] = useState(alertConfigs);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Simulate real-time market data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => prev.map(item => ({
        ...item,
        price: item.price * (1 + (Math.random() - 0.5) * 0.002),
        change: item.change + (Math.random() - 0.5) * 0.1,
      })));
      setLastUpdate(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    toast.success("Configuração de alerta atualizada");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendário, Mercado & Alertas</h1>
          <p className="text-muted-foreground">Dados de mercado em tempo real, eventos econômicos e alertas inteligentes</p>
        </div>

        <Tabs defaultValue="market">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="market">
              <Activity className="w-3.5 h-3.5 mr-1.5" /> Mercado ao Vivo
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5" /> Calendário
            </TabsTrigger>
            <TabsTrigger value="news">
              <Newspaper className="w-3.5 h-3.5 mr-1.5" /> Notícias
            </TabsTrigger>
            <TabsTrigger value="alerts">
              <Bell className="w-3.5 h-3.5 mr-1.5" /> Alertas
            </TabsTrigger>
          </TabsList>

          {/* Market Data - Real Time */}
          <TabsContent value="market" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-profit animate-pulse" />
                  <span className="text-xs text-muted-foreground">
                    Atualizado: {lastUpdate.toLocaleTimeString("pt-BR")}
                  </span>
                </div>
                <Badge variant="outline" className="text-xs border-profit/30 text-profit">
                  <Zap className="w-3 h-3 mr-1" /> Streaming Ativo
                </Badge>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {marketData.map((item) => (
                  <Card key={item.symbol} className="bg-card border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-primary">{item.symbol}</span>
                        {item.change >= 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-profit" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-loss" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{item.name}</p>
                      <p className="text-lg font-bold text-foreground mt-1">
                        {item.price > 1000 ? item.price.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-xs font-medium ${item.change >= 0 ? "text-profit" : "text-loss"}`}>
                          {item.change >= 0 ? "+" : ""}{item.change.toFixed(2)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">Vol: {item.volume}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Market Summary */}
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-profit" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mercado Nacional</p>
                        <p className="text-sm font-bold text-profit">Alta +1.23%</p>
                        <p className="text-[10px] text-muted-foreground">Ibovespa em máxima histórica</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                        <Globe className="w-5 h-5 text-profit" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Mercado Internacional</p>
                        <p className="text-sm font-bold text-profit">Alta +0.86%</p>
                        <p className="text-[10px] text-muted-foreground">S&P 500 e Nasdaq em alta</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-profit" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cripto</p>
                        <p className="text-sm font-bold text-profit">Alta +3.42%</p>
                        <p className="text-[10px] text-muted-foreground">BTC acima de $71K</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Calendar */}
          <TabsContent value="calendar" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-primary" /> Eventos de Hoje — {new Date().toLocaleDateString("pt-BR")}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className={impactColors.high}>Alto Impacto</Badge>
                    <Badge variant="outline" className={impactColors.medium}>Médio</Badge>
                    <Badge variant="outline" className={impactColors.low}>Baixo</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {economicEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 w-16">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-mono text-muted-foreground">{event.time}</span>
                        </div>
                        <Badge variant="outline" className={impactColors[event.impact as keyof typeof impactColors]}>
                          {event.impact === "high" ? "!!!" : event.impact === "medium" ? "!!" : "!"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{event.country}</span>
                          <span className="text-sm font-medium text-foreground">{event.event}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Previsão</p>
                          <p className="font-medium text-foreground">{event.forecast}</p>
                        </div>
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Anterior</p>
                          <p className="font-medium text-muted-foreground">{event.previous}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Atual</p>
                          <p className={`font-bold ${event.actual ? "text-profit" : "text-muted-foreground"}`}>
                            {event.actual || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* News */}
          <TabsContent value="news" className="mt-6">
            <div className="space-y-3">
              {news.map((item) => (
                <Card key={item.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                          item.impact === "high" ? "bg-loss/10" : "bg-primary/10"
                        }`}>
                          {item.impact === "high" ? (
                            <AlertTriangle className="w-5 h-5 text-loss" />
                          ) : (
                            <Newspaper className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-muted-foreground">{item.source}</span>
                            <span className="text-xs text-muted-foreground">{item.time}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">{item.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Alerts Configuration */}
          <TabsContent value="alerts" className="mt-6">
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-primary" /> Alertas Inteligentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure quais alertas você deseja receber. Os alertas são processados pela IA e enviados em tempo real.
                  </p>
                  <div className="space-y-4">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start justify-between p-4 rounded-lg bg-secondary/30 border border-border">
                        <div className="flex-1 mr-4">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm font-medium text-foreground cursor-pointer">
                              {alert.label}
                            </Label>
                            {alert.enabled && (
                              <Badge variant="outline" className="text-[10px] border-profit/30 text-profit">Ativo</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                        </div>
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={() => toggleAlert(alert.id)}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Alerts */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="w-4 h-4 text-warning" /> Alertas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { time: "14:32", type: "price_spike", message: "PETR4 subiu 3.2% nos últimos 15 minutos", severity: "warning" },
                      { time: "13:15", type: "economic_event", message: "Em 30min: Decisão Taxa de Juros Fed (Alto Impacto)", severity: "high" },
                      { time: "11:45", type: "volume_surge", message: "Volume anormal detectado em VALE3 (320% acima da média)", severity: "warning" },
                      { time: "10:20", type: "news_impact", message: "Notícia de alto impacto: Petrobras anuncia dividendos extraordinários", severity: "info" },
                      { time: "09:05", type: "trend_reversal", message: "IA detectou possível reversão de tendência em USD/BRL", severity: "info" },
                    ].map((alert, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          alert.severity === "high" ? "bg-loss" : alert.severity === "warning" ? "bg-warning" : "bg-primary"
                        }`} />
                        <span className="text-xs font-mono text-muted-foreground w-12">{alert.time}</span>
                        <span className="text-sm text-foreground">{alert.message}</span>
                      </div>
                    ))}
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
