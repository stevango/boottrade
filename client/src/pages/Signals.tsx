import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, RefreshCw, CheckCircle2, XCircle, MinusCircle, Loader2, Bot, Clock, TrendingUp, Filter, BarChart2, Sparkles, History } from "lucide-react";
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
  type AnalyzeCtx = { home: string; away: string; market: string; outcome: string; bestBook?: string; bestPrice?: number; avgPrice?: number; edgePct?: number; commence?: string; decisionId?: number };
  const [analyzing, setAnalyzing] = useState<AnalyzeCtx | null>(null);
  const analyzeMut = trpc.matchAnalysis.analyze.useMutation();

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
  // Fetch all advice the user has — we use it to badge signals that already
  // have an auto-generated recommendation waiting.
  const allAdvice = trpc.matchAnalysis.adviceHistory.useQuery({ limit: 200 });
  const advisedSet = new Set<number>(
    (allAdvice.data ?? [])
      .map((r: any) => r.decisionId)
      .filter((id: number | null): id is number => typeof id === "number"),
  );
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
            <div className="space-y-2">{pending.map((s) => <SignalRow key={s.id} s={s} hasAdvice={advisedSet.has(s.id)} onMark={(o) => { setMarking({ id: s.id, outcome: o }); setProfit(""); }} onAnalyze={(ctx) => { setAnalyzing(ctx); analyzeMut.mutate({ home: ctx.home, away: ctx.away }); }} />)}</div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" /> Histórico ({past.length})
            </h2>
            <div className="space-y-2">{past.map((s) => <SignalRow key={s.id} s={s} hasAdvice={advisedSet.has(s.id)} onMark={() => {}} onAnalyze={(ctx) => { setAnalyzing(ctx); analyzeMut.mutate({ home: ctx.home, away: ctx.away }); }} />)}</div>
          </section>
        )}
      </div>

      <Dialog open={!!analyzing} onOpenChange={(o) => !o && setAnalyzing(null)}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground text-base flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Análise: {analyzing?.home} × {analyzing?.away}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <MatchAnalysisPanel mut={analyzeMut} ctx={analyzing} />
          </div>
        </DialogContent>
      </Dialog>

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

function MatchAnalysisPanel({ mut, ctx }: { mut: any; ctx: { home: string; away: string; market: string; outcome: string; bestBook?: string; bestPrice?: number; avgPrice?: number; edgePct?: number; commence?: string; decisionId?: number } | null }) {
  if (mut.isPending) {
    return <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Buscando estatísticas (H2H + forma recente + predição)...
    </div>;
  }
  if (mut.isError || !mut.data) {
    return <p className="text-sm text-loss py-6 text-center">{mut.error?.message || "Falha ao buscar análise."}</p>;
  }
  const r = mut.data;
  if (r.configured === false) {
    return (
      <div className="p-4 rounded bg-warning/5 border border-warning/20 text-xs text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">{r.error}</p>
        <p>Cadastre-se em <a href="https://www.api-football.com" target="_blank" rel="noreferrer" className="text-primary underline">api-football.com</a> (free 100 req/dia, sem cartão), copie a chave e cole em <a href="/integrations" className="text-primary underline">Integrações</a> → API-Football.</p>
      </div>
    );
  }
  if (r.error) {
    return <p className="text-sm text-loss py-6 text-center">{r.error}</p>;
  }
  const a = r.analysis!;
  const pred = a.prediction;
  const gp = a.goalProbabilities;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <div className="space-y-4">
      {/* Predição */}
      <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <p className="text-sm font-medium text-foreground">Leitura preditiva</p>
          <Badge variant="outline" className={`text-[10px] ${pred.confidence === "high" ? "text-profit border-profit/30" : pred.confidence === "medium" ? "text-warning border-warning/30" : "text-muted-foreground"}`}>
            Confiança: {pred.confidence === "high" ? "alta" : pred.confidence === "medium" ? "média" : "baixa"}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <ProbCell label={a.team1.name} pct={pred.team1WinPct} highlight={pred.favorite === "team1"} />
          <ProbCell label="Empate" pct={pred.drawPct} highlight={pred.favorite === "draw"} />
          <ProbCell label={a.team2.name} pct={pred.team2WinPct} highlight={pred.favorite === "team2"} />
        </div>
        <p className="text-xs text-muted-foreground">Placar provável: <strong className="text-foreground">{pred.probableScore}</strong></p>
        <ul className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
          {pred.reasoning.map((r: string, i: number) => <li key={i}>• {r}</li>)}
        </ul>
      </div>

      {/* H2H */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Histórico direto (H2H)</p>
        {a.h2h.totalGames === 0 ? (
          <p className="text-xs text-muted-foreground">Sem confrontos registrados na base.</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center mb-2">
              <Stat label="Jogos" v={`${a.h2h.totalGames}`} />
              <Stat label={`Vit. ${a.team1.name}`} v={`${a.h2h.team1Wins}`} />
              <Stat label="Empates" v={`${a.h2h.draws}`} />
              <Stat label={`Vit. ${a.team2.name}`} v={`${a.h2h.team2Wins}`} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <Stat label={`Gols ${a.team1.name}`} v={`${a.h2h.goalsFor1}`} />
              <Stat label={`Gols ${a.team2.name}`} v={`${a.h2h.goalsFor2}`} />
              <Stat label="Média gols/jogo" v={a.h2h.avgGoals.toFixed(2)} />
            </div>
            {a.h2h.recent.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground mb-1">Últimos confrontos:</p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5">
                  {a.h2h.recent.map((m: any, i: number) => (
                    <li key={i}>• {new Date(m.date).toLocaleDateString("pt-BR")} — {m.home} {m.score} {m.away} <span className="text-muted-foreground/70">({m.competition})</span></li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Forma recente */}
      <div className="grid sm:grid-cols-2 gap-3">
        <FormCard form={a.form1} />
        <FormCard form={a.form2} />
      </div>

      {/* Plantel — Fase B */}
      {(a.squad1 || a.squad2) && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Plantel — atacantes</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {a.squad1 && <SquadCard team={a.team1.name} squad={a.squad1} />}
            {a.squad2 && <SquadCard team={a.team2.name} squad={a.squad2} />}
          </div>
        </div>
      )}

      {/* Probabilidade de gols */}
      <div>
        <p className="text-sm font-medium text-foreground mb-2">Probabilidade de gols</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label={`${a.team1.name} marca`} v={fmtPct(gp.team1ScoresPct)} />
          <Stat label={`${a.team2.name} marca`} v={fmtPct(gp.team2ScoresPct)} />
          <Stat label="Ambas marcam" v={fmtPct(gp.bothScorePct)} />
          <Stat label="Over 0.5" v={fmtPct(gp.over05Pct)} />
          <Stat label="Over 1.5" v={fmtPct(gp.over15Pct)} />
          <Stat label="Over 2.5" v={fmtPct(gp.over25Pct)} />
          <Stat label="Over 3.5" v={fmtPct(gp.over35Pct)} />
          <Stat label="Total esperado" v={gp.expectedTotal.toFixed(2)} />
        </div>
      </div>

      {ctx && <AdvisorSection ctx={ctx} />}

      <p className="text-[10px] text-muted-foreground text-center mt-2 italic">
        Análise estatística baseada em dados históricos e momento das seleções. Não é garantia de resultado.
        Gerada em {new Date(a.generatedAt).toLocaleString("pt-BR")}.
      </p>
    </div>
  );
}

// Parse the structured-text advice produced by buildAdvisorPrompt. The LLM
// is instructed to emit 6 lines starting with DECISÃO/TAMANHO/APOSTA/
// MERCADO_ALTERNATIVO/RISCO/RESUMO. We also strip ** markdown emphasis in
// case the model slips it in.
function parseAdvice(text: string): { decisao?: string; tamanho?: string; aposta?: string; alternativo?: string; risco?: string; resumo?: string; raw: string } {
  const lines = text.replace(/\*\*/g, "").split(/\r?\n/);
  const out: Record<string, string> = {};
  const map: Record<string, string> = {
    "DECISÃO": "decisao", "DECISAO": "decisao",
    "TAMANHO": "tamanho",
    "APOSTA": "aposta",
    "MERCADO_ALTERNATIVO": "alternativo", "MERCADO ALTERNATIVO": "alternativo",
    "RISCO": "risco",
    "RESUMO": "resumo",
  };
  let current = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-ZÇÃÕ_ ]+):\s*(.*)$/.exec(line);
    if (m && map[m[1].trim().toUpperCase()]) {
      current = map[m[1].trim().toUpperCase()];
      out[current] = m[2].trim();
    } else if (current) {
      out[current] = (out[current] ? out[current] + " " : "") + line;
    }
  }
  return { ...out, raw: text };
}

function IntelligencePanel({ bi }: { bi: any }) {
  const fmt = (n: number | null | undefined, suffix = "%") => n == null ? "—" : `${n.toFixed(1)}${suffix}`;
  return (
    <div className="p-3 rounded bg-secondary/40 border border-border">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Matemática da decisão</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <Cell label="Nossa prob." value={fmt(bi.ourProbabilityPct)} />
        <Cell label="Prob. do preço" value={fmt(bi.marketImpliedPct)} />
        <Cell label="Edge real" value={fmt(bi.ourEdgePct)} tone={bi.ourEdgePct != null && bi.ourEdgePct > 0 ? "profit" : "loss"} />
        <Cell label="Edge no feed" value={fmt(bi.reportedEdgePct)} />
        <Cell label="Kelly 1/4" value={bi.kellyPct == null ? "—" : `${bi.kellyPct.toFixed(2)}%`} />
        <Cell label="Amostra" value={bi.sampleQuality} />
        <Cell label="Stake R$" value={bi.recommendedStakeBrl > 0 ? `R$ ${bi.recommendedStakeBrl.toFixed(2)}` : "R$ 0"} />
        <Cell label="Lucro se ganhar" value={bi.expectedReturnBrl > 0 ? `R$ ${bi.expectedReturnBrl.toFixed(2)}` : "—"} tone="profit" />
      </div>
      {bi.bullets?.length > 0 && (
        <ul className="text-[11px] text-muted-foreground mt-2 space-y-0.5">
          {bi.bullets.map((b: string, i: number) => <li key={i}>• {b}</li>)}
        </ul>
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" }) {
  const color = tone === "profit" ? "text-profit" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <div className="p-2 rounded bg-card">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className={`text-xs font-medium ${color}`}>{value}</p>
    </div>
  );
}

function AdviceRender({ text }: { text: string }) {
  const a = parseAdvice(text);
  const decLower = (a.decisao || "").toLowerCase();
  const tone =
    decLower.startsWith("sim") ? { badge: "bg-profit text-background", border: "border-profit/40", label: "APOSTE" } :
    decLower.startsWith("nao") || decLower.startsWith("não") ? { badge: "bg-loss text-background", border: "border-loss/40", label: "NÃO APOSTE" } :
    decLower.includes("caut") ? { badge: "bg-warning text-background", border: "border-warning/40", label: "CAUTELOSO" } :
    { badge: "bg-secondary text-foreground", border: "border-border", label: a.decisao || "—" };

  // If parsing failed (no DECISÃO line found), render the raw text as fallback.
  if (!a.decisao) {
    return (
      <div className="p-3 rounded bg-card border border-border">
        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border-2 ${tone.border} overflow-hidden`}>
      {/* Big decision banner */}
      <div className={`${tone.badge} px-4 py-3 flex items-center justify-between flex-wrap gap-2`}>
        <span className="font-bold text-base tracking-wide">{tone.label}</span>
        {a.tamanho && <span className="text-xs font-medium opacity-90">Stake: {a.tamanho}</span>}
      </div>

      <div className="p-3 space-y-2 bg-card">
        {/* The bet itself — highlighted when SIM */}
        {a.aposta && a.aposta !== "-" && (
          <div className={`p-3 rounded ${decLower.startsWith("sim") ? "bg-profit/10 border border-profit/30" : "bg-secondary"}`}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Aposta sugerida</p>
            <p className="text-sm text-foreground font-medium leading-snug">{a.aposta}</p>
          </div>
        )}

        {a.alternativo && a.alternativo !== "-" && (
          <Line label="Alternativa mais segura" value={a.alternativo} />
        )}
        {a.risco && <Line label="Risco principal" value={a.risco} />}
        {a.resumo && <Line label="Resumo" value={a.resumo} />}

        <p className="text-[10px] text-muted-foreground pt-1">Recomendação salva no histórico.</p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="text-xs text-foreground leading-snug">{value}</p>
    </div>
  );
}

function AdvisorSection({ ctx }: { ctx: { home: string; away: string; market: string; outcome: string; bestBook?: string; bestPrice?: number; avgPrice?: number; edgePct?: number; commence?: string; decisionId?: number } }) {
  const adviseMut = trpc.matchAnalysis.advise.useMutation();
  const utils = trpc.useUtils();
  const history = trpc.matchAnalysis.adviceHistory.useQuery(
    { decisionId: ctx.decisionId, limit: 5 },
    { enabled: ctx.decisionId != null },
  );
  const balanceQuery = trpc.user.getBalance.useQuery();
  const setBalance = trpc.user.setBalance.useMutation({
    onSuccess: () => { toast.success("Banca atualizada."); utils.user.getBalance.invalidate(); setEditingBalance(false); },
  });
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const run = () => {
    adviseMut.mutate({
      home: ctx.home, away: ctx.away,
      market: ctx.market, outcome: ctx.outcome,
      bestBook: ctx.bestBook, bestPrice: ctx.bestPrice,
      avgPrice: ctx.avgPrice, edgePct: ctx.edgePct,
      commence: ctx.commence, decisionId: ctx.decisionId,
    }, { onSuccess: () => utils.matchAnalysis.adviceHistory.invalidate() });
  };

  const r = adviseMut.data;
  const past = history.data ?? [];

  return (
    <div className="p-3 rounded-lg bg-secondary/40 border border-primary/20 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Consultor IA
        </p>
        <div className="flex items-center gap-1">
          {past.length > 0 && (
            <Button size="sm" variant="ghost" className="text-[11px] text-muted-foreground" onClick={() => setShowHistory((v) => !v)}>
              <History className="w-3 h-3 mr-1" /> Histórico ({past.length})
            </Button>
          )}
          <Button size="sm" onClick={run} disabled={adviseMut.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {adviseMut.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pensando...</> : <><Sparkles className="w-3 h-3 mr-1" /> Pedir orientação</>}
          </Button>
        </div>
      </div>

      {r?.configured === false && (
        <div className="p-2 rounded bg-warning/5 border border-warning/20 text-[11px] text-muted-foreground">{r.error}</div>
      )}
      {r?.error && r?.configured !== false && (
        <p className="text-[11px] text-loss">{r.error}</p>
      )}
      {r?.intelligence && <IntelligencePanel bi={r.intelligence} />}
      {r?.advice && <AdviceRender text={r.advice} />}

      {showHistory && past.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-[11px] text-muted-foreground">Recomendações anteriores para este sinal:</p>
          {past.map((p: any) => (
            <div key={p.id} className="space-y-1">
              <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleString("pt-BR")}</p>
              <AdviceRender text={p.advice} />
            </div>
          ))}
        </div>
      )}

      {!r && past.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          O consultor analisa o sinal junto com a estatística (H2H, forma, probabilidades) e devolve uma recomendação prática:
          se vale, tamanho de aposta (% banca), risco, mercado alternativo e veredito final. Toda recomendação fica salva.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border text-[11px]">
        <span className="text-muted-foreground">Banca de referência (usada pra calcular o stake em R$):</span>
        {editingBalance ? (
          <div className="flex items-center gap-1">
            <Input
              type="number" min="0" step="100" value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              autoFocus
              className="h-6 w-24 text-[11px] bg-secondary border-border"
            />
            <Button size="sm" className="h-6 px-2 text-[11px] bg-primary text-primary-foreground"
              onClick={() => setBalance.mutate({ balance: parseFloat(balanceInput) || 0 })}
              disabled={setBalance.isPending}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => setEditingBalance(false)}>Cancelar</Button>
          </div>
        ) : (
          <button
            className="text-primary hover:underline font-medium"
            onClick={() => { setBalanceInput(String(balanceQuery.data?.balance ?? 5000)); setEditingBalance(true); }}
          >
            R$ {(balanceQuery.data?.balance ?? 5000).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · editar
          </button>
        )}
      </div>
    </div>
  );
}

function ProbCell({ label, pct, highlight }: { label: string; pct: number; highlight: boolean }) {
  return (
    <div className={`p-2 rounded text-center ${highlight ? "bg-primary/15 border border-primary/40" : "bg-secondary"}`}>
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className={`text-base font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{pct.toFixed(1)}%</p>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="p-2 rounded bg-secondary text-center">
      <p className="text-[10px] text-muted-foreground truncate">{label}</p>
      <p className="text-sm font-medium text-foreground">{v}</p>
    </div>
  );
}

function SquadCard({ team, squad }: { team: string; squad: any }) {
  const attackers = squad.attackers ?? [];
  const midfielders = squad.midfielders ?? [];
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
      <p className="text-sm font-medium text-foreground mb-2">{team}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Atacantes ({attackers.length})</p>
      <div className="space-y-0.5 mb-2">
        {attackers.slice(0, 6).map((p: any) => (
          <p key={p.id} className="text-[11px] text-foreground">
            {p.number != null && <span className="text-muted-foreground">#{p.number} </span>}
            {p.name}
            {p.age != null && <span className="text-muted-foreground"> · {p.age}a</span>}
          </p>
        ))}
        {attackers.length === 0 && <p className="text-[10px] text-muted-foreground italic">Sem dados de atacantes.</p>}
      </div>
      {midfielders.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Meio-campo ({midfielders.length})</p>
          <p className="text-[11px] text-foreground">{midfielders.slice(0, 5).map((p: any) => p.name).join(", ")}{midfielders.length > 5 ? "…" : ""}</p>
        </>
      )}
    </div>
  );
}

function FormCard({ form }: { form: any }) {
  const w12 = form.windows.find((w: any) => w.months === 12) || form.windows[0];
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
      <p className="text-sm font-medium text-foreground mb-2">{form.teamName} · últimos {w12.months}m</p>
      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        <Stat label="Jogos" v={`${w12.games}`} />
        <Stat label="V" v={`${w12.wins}`} />
        <Stat label="E" v={`${w12.draws}`} />
        <Stat label="D" v={`${w12.losses}`} />
      </div>
      <div className="grid grid-cols-3 gap-1 text-center mb-2">
        <Stat label="Aproveit." v={`${w12.pointsRate.toFixed(0)}%`} />
        <Stat label="Gols pró/jg" v={w12.avgGF.toFixed(2)} />
        <Stat label="Gols sof/jg" v={w12.avgGA.toFixed(2)} />
      </div>
      {form.lastResults.length > 0 && (
        <div className="flex gap-1 justify-center">
          {form.lastResults.slice(0, 5).map((r: any, i: number) => (
            <span key={i} className={`text-[10px] w-5 h-5 rounded-full inline-flex items-center justify-center font-bold ${
              r.result === "W" ? "bg-profit/15 text-profit" : r.result === "L" ? "bg-loss/15 text-loss" : "bg-muted-foreground/20 text-muted-foreground"
            }`} title={`${new Date(r.date).toLocaleDateString("pt-BR")} vs ${r.opponent}: ${r.goalsFor}-${r.goalsAgainst}`}>{r.result}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function parseAssetTeams(asset: string): { home: string; away: string; market: string; outcome: string } | null {
  const m = /^(.+?)\s*×\s*(.+?)\s*\|\s*([^|]+?)\s*\|\s*(.+?)$/.exec(asset);
  if (!m) return null;
  return { home: m[1].trim(), away: m[2].trim(), market: m[3].trim(), outcome: m[4].trim() };
}

// Reasoning shape: "[source] 14.00 @ BetOnline.ag vs média 6.08 entre 34 casas (edge 27.7%) em 15/06/2026, 16:00:00."
function parseReasoning(reasoning: string | null): { bestPrice?: number; bestBook?: string; avgPrice?: number; commence?: string } {
  if (!reasoning) return {};
  const m = /(\d+(?:\.\d+)?)\s*@\s*([^v]+?)\s+vs\s+média\s+(\d+(?:\.\d+)?)/.exec(reasoning);
  const t = /em\s+(\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}(?::\d{2})?)/.exec(reasoning);
  const out: { bestPrice?: number; bestBook?: string; avgPrice?: number; commence?: string } = {};
  if (m) {
    out.bestPrice = parseFloat(m[1]);
    out.bestBook = m[2].trim();
    out.avgPrice = parseFloat(m[3]);
  }
  if (t) {
    // "15/06/2026, 16:00:00" → ISO
    const [d, hms] = t[1].split(",").map((s) => s.trim());
    const [dd, mm, yy] = d.split("/");
    out.commence = `${yy}-${mm}-${dd}T${hms || "00:00:00"}Z`;
  }
  return out;
}

function SignalRow({ s, hasAdvice, onMark, onAnalyze }: { s: Signal; hasAdvice?: boolean; onMark: (o: "profit" | "loss" | "neutral") => void; onAnalyze: (ctx: { home: string; away: string; market: string; outcome: string; bestBook?: string; bestPrice?: number; avgPrice?: number; edgePct?: number; commence?: string; decisionId?: number }) => void }) {
  const conf = parseFloat(s.confidence || "0");
  const isPending = s.outcome === "pending";
  const teams = parseAssetTeams(s.asset);
  const r = parseReasoning(s.reasoning);
  const ctx = teams ? { home: teams.home, away: teams.away, market: teams.market, outcome: teams.outcome, edgePct: conf, decisionId: s.id, ...r } : null;
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30 text-[10px]">+{conf.toFixed(1)}%</Badge>
            <Badge variant="outline" className={`text-[10px] ${outcomeColor[s.outcome]}`}>{outcomeLabel[s.outcome]}</Badge>
            {hasAdvice && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]" title="O consultor IA já gerou uma recomendação automática pra este sinal — clique em Analisar partida pra ver">
                <Sparkles className="w-2.5 h-2.5 mr-1" /> orientado
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {s.robotName ?? "Robô"} · {new Date(s.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm text-foreground font-medium">{s.asset}</p>
          {s.reasoning && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{s.reasoning}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isPending && (
            <div className="flex gap-1">
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
          {ctx && (
            <Button size="sm" variant="ghost" className="text-[11px] text-primary hover:bg-primary/10" onClick={() => onAnalyze(ctx)}>
              <BarChart2 className="w-3 h-3 mr-1" /> Analisar partida
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
