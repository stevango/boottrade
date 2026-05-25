import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon, Newspaper, Bell, BellRing, Clock, Activity,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
            <ComingSoon
              icon={Activity}
              title="Cotações em tempo real"
              desc="Preços ao vivo de ações, índices e cripto dependem da integração com um feed de mercado (B3 / exchanges). Vamos habilitar assim que a fonte de dados estiver conectada."
            />
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
