import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Loader2, FlaskConical, ArrowRight, ArrowDown } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Simulation() {
  const sim = trpc.signals.simulatedPnl.useQuery();
  if (sim.isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center p-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }
  if (!sim.data) {
    return (
      <AppLayout>
        <Card className="bg-card border-border">
          <CardContent className="p-6 text-sm text-muted-foreground text-center">Sem dados ainda.</CardContent>
        </Card>
      </AppLayout>
    );
  }

  const d = sim.data;
  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tone = (n: number) => n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <FlaskConical className="w-7 h-7 text-primary" /> Simulação do Robô
          </h1>
          <p className="text-muted-foreground text-sm max-w-3xl leading-relaxed">
            Se você tivesse apostado <strong>cegamente em tudo que o consultor disse SIM</strong>, com o
            stake exato que ele recomendou, quanto você teria ganhado ou perdido? Sistema usa o resultado
            real dos jogos (via The Odds API) pra calcular. Não conta dinheiro real — é só pra você
            avaliar a qualidade das sugestões antes de apostar de verdade.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Window label="Hoje" d={d.day} fmt={fmt} tone={tone} />
          <Window label="7 dias" d={d.week} fmt={fmt} tone={tone} />
          <Window label="30 dias" d={d.month} fmt={fmt} tone={tone} />
          <Window label="Total" d={d.all} fmt={fmt} tone={tone} highlight />
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Apostas simuladas recentes (top 50)
            </p>
            {d.all.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma sugestão SIM resolvida ainda. Esperando jogos da Copa começarem (11/06) e o sistema
                consultar o placar via /scores.
              </p>
            ) : (
              <div className="space-y-2">
                {d.all.items.map((it: any) => (
                  <div key={it.decisionId} className={`p-3 rounded ${it.outcome === "won" ? "bg-profit/5 border border-profit/20" : "bg-loss/5 border border-loss/20"}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {it.outcome === "won"
                          ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30 text-[10px]">Robô acertou ✓</Badge>
                          : <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30 text-[10px]">Robô errou ✗</Badge>}
                        <p className="text-sm text-foreground font-medium">
                          {it.match}
                          <span className="text-muted-foreground"> → </span>
                          <span className="text-primary">{it.outcomeBet}</span>
                        </p>
                        <Badge variant="outline" className="text-[10px]">{it.bestPrice.toFixed(2)} @ {it.bestBook ?? "?"}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Stake {fmt(it.stake)}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className={`font-bold ${tone(it.pnl)}`}>{it.pnl >= 0 ? "+" : ""}{fmt(it.pnl)}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(it.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Window({ label, d, fmt, tone, highlight }: { label: string; d: any; fmt: (n: number) => string; tone: (n: number) => string; highlight?: boolean }) {
  return (
    <Card className={`bg-card ${highlight ? "border-primary/30" : "border-border"}`}>
      <CardContent className="p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${tone(d.net)}`}>
          {d.net >= 0 ? "+" : ""}{fmt(d.net)}
        </p>
        <div className="space-y-1 pt-2 border-t border-border">
          <Row label="Apostado" value={fmt(d.staked)} />
          <Row label="ROI" value={`${d.roiPct >= 0 ? "+" : ""}${d.roiPct.toFixed(1)}%`} tone={tone(d.roiPct)} />
          <Row label="Acurácia" value={`${d.accuracyPct.toFixed(0)}% (${d.correct}/${d.settled})`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone || "text-foreground"}`}>{value}</span>
    </div>
  );
}
