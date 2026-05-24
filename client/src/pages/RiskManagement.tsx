import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Shield, AlertTriangle, TrendingDown, Activity, Bell, Save } from "lucide-react";

const riskMetrics = [
  { label: "Perda Diária", current: 180, limit: 500, percentage: 36, status: "safe" },
  { label: "Drawdown Atual", current: 3.2, limit: 10, percentage: 32, status: "safe" },
  { label: "Posições Abertas", current: 3, limit: 5, percentage: 60, status: "warning" },
  { label: "Alavancagem", current: 4.2, limit: 10, percentage: 42, status: "safe" },
];

const alerts = [
  { id: 1, type: "warning", message: "Drawdown se aproximando do limite (32%)", time: "14:30" },
  { id: 2, type: "info", message: "Robô Athena AI atingiu take profit em WINFUT", time: "13:45" },
  { id: 3, type: "danger", message: "Stop loss acionado em EUR/USD pelo Odin AI", time: "12:20" },
  { id: 4, type: "info", message: "Gestão de risco desativou Kraken AI temporariamente", time: "11:15" },
  { id: 5, type: "success", message: "Meta diária atingida: +R$ 1.200", time: "10:30" },
];

export default function RiskManagement() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Risco</h1>
          <p className="text-muted-foreground">Configure limites e proteja seu capital</p>
        </div>

        {/* Risk Status */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {riskMetrics.map((metric) => (
            <Card key={metric.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{metric.label}</span>
                  <Shield className={`w-4 h-4 ${metric.status === "safe" ? "text-profit" : "text-warning"}`} />
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-xl font-bold text-foreground">
                    {typeof metric.current === "number" && metric.current % 1 !== 0 ? `${metric.current}%` : metric.label.includes("Perda") ? `R$ ${metric.current}` : metric.current}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {metric.label.includes("Perda") ? `R$ ${metric.limit}` : metric.label.includes("Posições") ? metric.limit : `${metric.limit}%`}
                  </span>
                </div>
                <Progress
                  value={metric.percentage}
                  className="h-2"
                />
                <p className={`text-xs mt-1 ${metric.percentage > 70 ? "text-loss" : metric.percentage > 50 ? "text-warning" : "text-profit"}`}>
                  {metric.percentage}% utilizado
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Settings */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Configurações de Risco
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Stop Loss Padrão (%)</Label>
                  <Input type="number" defaultValue="2.0" step="0.1" className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Take Profit Padrão (%)</Label>
                  <Input type="number" defaultValue="4.0" step="0.1" className="bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Perda Diária Máx. (R$)</Label>
                  <Input type="number" defaultValue="500" className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Drawdown Máximo (%)</Label>
                  <Input type="number" defaultValue="10" step="0.5" className="bg-secondary border-border" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Máx. Posições Abertas</Label>
                  <Input type="number" defaultValue="5" className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Alavancagem Máxima</Label>
                  <Input type="number" defaultValue="10" className="bg-secondary border-border" />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Auto-Stop</p>
                    <p className="text-xs text-muted-foreground">Desligar robôs ao atingir limite</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Alertas Inteligentes</p>
                    <p className="text-xs text-muted-foreground">Notificações de risco em tempo real</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium text-foreground">Hedge Automático</p>
                    <p className="text-xs text-muted-foreground">Proteção contra movimentos adversos</p>
                  </div>
                  <Switch />
                </div>
              </div>

              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                <Save className="w-4 h-4 mr-2" /> Salvar Configurações
              </Button>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Alertas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                    alert.type === "danger" ? "bg-loss/5 border border-loss/20" :
                    alert.type === "warning" ? "bg-warning/5 border border-warning/20" :
                    alert.type === "success" ? "bg-profit/5 border border-profit/20" :
                    "bg-secondary/30"
                  }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      alert.type === "danger" ? "bg-loss/10" :
                      alert.type === "warning" ? "bg-warning/10" :
                      alert.type === "success" ? "bg-profit/10" :
                      "bg-primary/10"
                    }`}>
                      {alert.type === "danger" ? <TrendingDown className="w-4 h-4 text-loss" /> :
                       alert.type === "warning" ? <AlertTriangle className="w-4 h-4 text-warning" /> :
                       alert.type === "success" ? <Activity className="w-4 h-4 text-profit" /> :
                       <Bell className="w-4 h-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
