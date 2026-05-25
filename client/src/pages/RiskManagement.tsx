import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Shield, Bell, Save, Loader2 } from "lucide-react";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const num = (v: unknown) => parseFloat(String(v ?? "0"));

export default function RiskManagement() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.risk.getSettings.useQuery();
  const { data: trades } = trpc.trades.list.useQuery({ limit: 100 });
  const { data: pnl } = trpc.pnl.daily.useQuery({ days: 90 });

  const [form, setForm] = useState({
    defaultStopLoss: "2.0", defaultTakeProfit: "4.0", maxDailyLoss: "500", maxDrawdown: "10",
    maxOpenPositions: "5", maxLeverage: "10", autoStopEnabled: true, alertsEnabled: true,
  });

  useEffect(() => {
    if (!settings) return;
    setForm({
      defaultStopLoss: String(num(settings.defaultStopLoss)),
      defaultTakeProfit: String(num(settings.defaultTakeProfit)),
      maxDailyLoss: String(num(settings.maxDailyLoss)),
      maxDrawdown: String(num(settings.maxDrawdown)),
      maxOpenPositions: String(settings.maxOpenPositions ?? 5),
      maxLeverage: String(num(settings.maxLeverage)),
      autoStopEnabled: settings.autoStopEnabled ?? true,
      alertsEnabled: settings.alertsEnabled ?? true,
    });
  }, [settings]);

  const saveMutation = trpc.risk.updateSettings.useMutation({
    onSuccess: () => { toast.success("Configurações salvas."); utils.risk.getSettings.invalidate(); },
    onError: () => toast.error("Falha ao salvar."),
  });

  const save = () => saveMutation.mutate({
    defaultStopLoss: num(form.defaultStopLoss), defaultTakeProfit: num(form.defaultTakeProfit),
    maxDailyLoss: num(form.maxDailyLoss), maxDrawdown: num(form.maxDrawdown),
    maxOpenPositions: parseInt(form.maxOpenPositions, 10) || 0, maxLeverage: num(form.maxLeverage),
    autoStopEnabled: form.autoStopEnabled, alertsEnabled: form.alertsEnabled,
  });

  // Real metrics
  const openPositions = (trades ?? []).filter((t: any) => t.status === "open").length;
  const todayLoss = useMemo(() => {
    const rows = pnl ?? [];
    if (rows.length === 0) return 0;
    const net = num(rows[0].netProfit);
    return net < 0 ? Math.abs(net) : 0;
  }, [pnl]);
  const currentDrawdown = useMemo(() => {
    const rows = [...(pnl ?? [])].reverse();
    if (rows.length === 0) return 0;
    let cum = 0, peak = 0, maxDD = 0;
    for (const r of rows) { cum += num(r.netProfit); peak = Math.max(peak, cum); if (peak > 0) maxDD = Math.min(maxDD, ((cum - peak) / peak) * 100); }
    return Math.abs(maxDD);
  }, [pnl]);

  const maxDailyLoss = num(form.maxDailyLoss);
  const maxDrawdownLimit = num(form.maxDrawdown);
  const maxPos = parseInt(form.maxOpenPositions, 10) || 0;

  const metrics = [
    { label: "Perda Diária", value: `R$ ${todayLoss.toLocaleString("pt-BR")}`, suffix: `/ R$ ${maxDailyLoss.toLocaleString("pt-BR")}`, pct: maxDailyLoss > 0 ? Math.min((todayLoss / maxDailyLoss) * 100, 100) : 0 },
    { label: "Drawdown Atual", value: `${currentDrawdown.toFixed(1)}%`, suffix: `/ ${maxDrawdownLimit}%`, pct: maxDrawdownLimit > 0 ? Math.min((currentDrawdown / maxDrawdownLimit) * 100, 100) : 0 },
    { label: "Posições Abertas", value: `${openPositions}`, suffix: `/ ${maxPos}`, pct: maxPos > 0 ? Math.min((openPositions / maxPos) * 100, 100) : 0 },
    { label: "Alavancagem", value: "—", suffix: `/ ${num(form.maxLeverage)}x`, pct: 0 },
  ];

  const buildContext = () => {
    return `Configurações de risco do usuário:
- Stop Loss padrão: ${form.defaultStopLoss}%
- Take Profit padrão: ${form.defaultTakeProfit}%
- Perda diária máxima: R$ ${form.maxDailyLoss}
- Drawdown máximo: ${form.maxDrawdown}%
- Máx. posições abertas: ${form.maxOpenPositions}
- Alavancagem máxima: ${form.maxLeverage}x
- Auto-Stop: ${form.autoStopEnabled ? "ligado" : "desligado"}
- Alertas: ${form.alertsEnabled ? "ligados" : "desligados"}

Métricas atuais (dados reais):
- Perda hoje: R$ ${todayLoss.toFixed(2)} (limite R$ ${maxDailyLoss})
- Drawdown atual: ${currentDrawdown.toFixed(1)}% (limite ${maxDrawdownLimit}%)
- Posições abertas: ${openPositions} (limite ${maxPos})`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Risco</h1>
          <p className="text-muted-foreground">Configure limites, monitore seu risco real e receba orientação da IA</p>
        </div>

        {/* Real risk status */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <Card key={m.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">{m.label}</span>
                  <Shield className={`w-4 h-4 ${m.pct > 70 ? "text-loss" : m.pct > 50 ? "text-warning" : "text-profit"}`} />
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-xl font-bold text-foreground">{m.value}</span>
                  <span className="text-xs text-muted-foreground">{m.suffix}</span>
                </div>
                <Progress value={m.pct} className="h-2" />
                <p className={`text-xs mt-1 ${m.pct > 70 ? "text-loss" : m.pct > 50 ? "text-warning" : "text-profit"}`}>{m.pct.toFixed(0)}% utilizado</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Risk Advisor */}
        <AdvisorPanel
          topic="risco"
          title="Consultor de Risco IA"
          description="Preencha suas configurações abaixo e peça uma análise — a IA aponta o que corrigir e como minimizar risco com base nos seus dados reais."
          getContext={buildContext}
          buttonLabel="Analisar meu risco"
        />

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Settings */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> Configurações de Risco</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Stop Loss Padrão (%)</Label>
                  <Input type="number" step="0.1" value={form.defaultStopLoss} onChange={(e) => setForm({ ...form, defaultStopLoss: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Take Profit Padrão (%)</Label>
                  <Input type="number" step="0.1" value={form.defaultTakeProfit} onChange={(e) => setForm({ ...form, defaultTakeProfit: e.target.value })} className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Perda Diária Máx. (R$)</Label>
                  <Input type="number" value={form.maxDailyLoss} onChange={(e) => setForm({ ...form, maxDailyLoss: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Drawdown Máximo (%)</Label>
                  <Input type="number" step="0.5" value={form.maxDrawdown} onChange={(e) => setForm({ ...form, maxDrawdown: e.target.value })} className="bg-secondary border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Máx. Posições Abertas</Label>
                  <Input type="number" value={form.maxOpenPositions} onChange={(e) => setForm({ ...form, maxOpenPositions: e.target.value })} className="bg-secondary border-border" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Alavancagem Máxima</Label>
                  <Input type="number" value={form.maxLeverage} onChange={(e) => setForm({ ...form, maxLeverage: e.target.value })} className="bg-secondary border-border" />
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div><p className="text-sm font-medium text-foreground">Auto-Stop</p><p className="text-xs text-muted-foreground">Desligar robôs ao atingir limite</p></div>
                  <Switch checked={form.autoStopEnabled} onCheckedChange={(v) => setForm({ ...form, autoStopEnabled: v })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div><p className="text-sm font-medium text-foreground">Alertas Inteligentes</p><p className="text-xs text-muted-foreground">Notificações de risco em tempo real</p></div>
                  <Switch checked={form.alertsEnabled} onCheckedChange={(v) => setForm({ ...form, alertsEnabled: v })} />
                </div>
              </div>

              <Button onClick={save} disabled={saveMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {saveMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4 mr-2" /> Salvar Configurações</>}
              </Button>
            </CardContent>
          </Card>

          {/* Alerts */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Alertas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                <Bell className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhum alerta ainda</p>
                <p className="text-xs text-muted-foreground/70">Alertas de risco aparecerão aqui quando o monitor em tempo real estiver ativo.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
