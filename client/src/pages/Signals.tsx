import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, RefreshCw, CheckCircle2, XCircle, MinusCircle, Loader2, Bot, Clock, TrendingUp, Filter } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

type Signal = {
  id: number;
  robotId: number;
  robotName: string | null;
  robotSlug: string | null;
  market: string | null;
  decision: "buy" | "sell" | "hold" | "close";
  asset: string;
  confidence: string;
  reasoning: string | null;
  outcome: "profit" | "loss" | "neutral" | "pending";
  profitAmount: string | null;
  executedBy: "human" | "robot";
  createdAt: string | Date;
};

const outcomeColor: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  profit: "bg-profit/10 text-profit border-profit/30",
  loss: "bg-loss/10 text-loss border-loss/30",
  neutral: "bg-secondary text-muted-foreground border-border",
};
const outcomeLabel: Record<string, string> = {
  pending: "Pendente",
  profit: "Ganhou",
  loss: "Perdeu",
  neutral: "Anulado",
};

export default function Signals() {
  const { data, isLoading, refetch, isFetching } = trpc.signals.list.useQuery({ limit: 100 });
  const utils = trpc.useUtils();
  const markMut = trpc.signals.markResult.useMutation({
    onSuccess: () => {
      toast.success("Resultado registrado. Cérebro aprendeu.");
      utils.signals.list.invalidate();
      setMarking(null);
    },
    onError: () => toast.error("Falha ao registrar."),
  });
  const runMut = trpc.signals.runOracleNow.useMutation({
    onSuccess: (r) => {
      if (r.error) toast.error(r.error);
      else toast.success(`Oracle AI rodou — ${r.created} sinais novos (${r.sources.join(", ") || "sem fonte"})`);
      utils.signals.list.invalidate();
    },
    onError: () => toast.error("Falha ao rodar Oracle."),
  });
  const resolveMut = trpc.signals.resolveNow.useMutation({
    onSuccess: (r) => {
      toast.success(`Resultados atualizados — ${r.resolved} de ${r.checked} sinais resolvidos automaticamente${r.errors ? ` (${r.errors} erros)` : ""}`);
      utils.signals.list.invalidate();
    },
    onError: () => toast.error("Falha ao buscar resultados."),
  });

  const [marking, setMarking] = useState<{ id: number; outcome: "profit" | "loss" | "neutral" } | null>(null);
  const [profit, setProfit] = useState<string>("");

  const submitMarking = () => {
    if (!marking) return;
    const amt = parseFloat(profit) || 0;
    markMut.mutate({ id: marking.id, outcome: marking.outcome, profitAmount: amt });
  };

  // Filters
  const [minEdge, setMinEdge] = useState<string>("0");
  const [robotFilter, setRobotFilter] = useState<string>("__all__");
  const [marketFilter, setMarketFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  const all: Signal[] = (data as unknown as Signal[]) ?? [];
  const robotOptions = Array.from(new Set(all.map((s) => s.robotName).filter((n): n is string => !!n))).sort();
  const marketOptions = Array.from(new Set(all.map((s) => {
    const m = s.asset.split("|")[1]?.trim();
    return m;
  }).filter((m): m is string => !!m))).sort();

  const minEdgeNum = parseFloat(minEdge) || 0;
  const signals = all.filter((s) => {
    if (parseFloat(s.confidence || "0") < minEdgeNum) return false;
    if (robotFilter !== "__all__" && s.robotName !== robotFilter) return false;
    if (marketFilter !== "__all__") {
      const m = s.asset.split("|")[1]?.trim();
      if (m !== marketFilter) return false;
    }
    if (statusFilter !== "__all__" && s.outcome !== statusFilter) return false;
    return true;
  });
  const pending = signals.filter((s) => s.outcome === "pending");
  const past = signals.filter((s) => s.outcome !== "pending");

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Zap className="w-7 h-7 text-primary" /> Sinais ao Vivo
            </h1>
            <p className="text-muted-foreground text-sm">
              Sinais gerados pelos robôs ativos. Marque o resultado depois pra o cérebro aprender.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Recarregar
            </Button>
            <Button variant="outline" size="sm" onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}
              title="Consulta os placares dos jogos já encerrados e marca Ganhou/Perdeu automaticamente nos sinais h2h.">
              {resolveMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Atualizar resultados
            </Button>
            <Button size="sm" onClick={() => runMut.mutate()} disabled={runMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {runMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />} Rodar Oracle agora
            </Button>
          </div>
        </div>

        {all.length > 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filtros · {signals.length} de {all.length} sinais</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Edge mínimo (%)</Label>
                  <Input
                    type="number" min="0" max="100" step="0.5" value={minEdge}
                    onChange={(e) => setMinEdge(e.target.value)}
                    className="bg-secondary border-border h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Robô</Label>
                  <Select value={robotFilter} onValueChange={setRobotFilter}>
                    <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {robotOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Mercado</Label>
                  <Select value={marketFilter} onValueChange={setMarketFilter}>
                    <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      {marketOptions.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="profit">Ganhou</SelectItem>
                      <SelectItem value="loss">Perdeu</SelectItem>
                      <SelectItem value="neutral">Anulado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <Card className="bg-card border-border"><CardContent className="p-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
        )}

        {!isLoading && signals.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              <Bot className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              Nenhum sinal ainda. Ative um robô em <a href="/robots" className="text-primary underline">Robôs</a> e clique em <strong>Rodar Oracle agora</strong> acima pra gerar a primeira leva. O scheduler também roda automaticamente a cada hora.
            </CardContent>
          </Card>
        )}

        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" /> Pendentes ({pending.length})
            </h2>
            <div className="space-y-2">{pending.map((s) => <SignalRow key={s.id} s={s} onMark={(o) => { setMarking({ id: s.id, outcome: o }); setProfit(""); }} />)}</div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Histórico ({past.length})
            </h2>
            <div className="space-y-2">{past.map((s) => <SignalRow key={s.id} s={s} onMark={() => {}} />)}</div>
          </section>
        )}
      </div>

      <Dialog open={!!marking} onOpenChange={(o) => !o && setMarking(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base">
              Registrar como {marking ? outcomeLabel[marking.outcome] : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                {marking?.outcome === "profit" ? "Lucro (R$)" : marking?.outcome === "loss" ? "Prejuízo (R$, número positivo)" : "Valor (R$, opcional)"}
              </label>
              <Input
                type="number" step="0.01" min="0"
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                placeholder="0,00"
                className="bg-secondary border-border"
              />
              <p className="text-[10px] text-muted-foreground">
                Use 0 se a aposta foi simulada ou não houve dinheiro real. O cérebro aprende com o outcome, o valor é só pra contabilidade.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setMarking(null)}>Cancelar</Button>
              <Button onClick={submitMarking} disabled={markMut.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                {markMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function SignalRow({ s, onMark }: { s: Signal; onMark: (o: "profit" | "loss" | "neutral") => void }) {
  const conf = parseFloat(s.confidence || "0");
  const isPending = s.outcome === "pending";
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30 text-[10px]">+{conf.toFixed(1)}%</Badge>
            <Badge variant="outline" className={`text-[10px] ${outcomeColor[s.outcome]}`}>{outcomeLabel[s.outcome]}</Badge>
            <span className="text-[10px] text-muted-foreground">
              {s.robotName ?? "Robô"} · {new Date(s.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm text-foreground font-medium">{s.asset}</p>
          {s.reasoning && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.reasoning}</p>}
        </div>
        {isPending && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="outline" className="text-xs text-profit border-profit/30 hover:bg-profit/10" onClick={() => onMark("profit")}>
              <CheckCircle2 className="w-3 h-3 mr-1" /> Ganhou
            </Button>
            <Button size="sm" variant="outline" className="text-xs text-loss border-loss/30 hover:bg-loss/10" onClick={() => onMark("loss")}>
              <XCircle className="w-3 h-3 mr-1" /> Perdeu
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => onMark("neutral")}>
              <MinusCircle className="w-3 h-3 mr-1" /> Anular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
