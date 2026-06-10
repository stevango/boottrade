import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

// Same parser used in Signals.tsx so we render structured advice with
// the colored decision banner everywhere.
function parseAdvice(text: string) {
  const lines = text.replace(/\*\*/g, "").split(/\r?\n/);
  const out: Record<string, string> = {};
  const map: Record<string, string> = {
    "DECISÃO": "decisao", "DECISAO": "decisao",
    "TAMANHO": "tamanho", "APOSTA": "aposta",
    "MERCADO_ALTERNATIVO": "alternativo", "MERCADO ALTERNATIVO": "alternativo",
    "RISCO": "risco", "RESUMO": "resumo",
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
  return out;
}

function DecisionBadge({ decision }: { decision?: string }) {
  const d = (decision || "").toLowerCase();
  const cfg =
    d.startsWith("sim") ? { color: "bg-profit text-background", label: "APOSTE" } :
    d.startsWith("nao") || d.startsWith("não") ? { color: "bg-loss text-background", label: "NÃO APOSTE" } :
    d.includes("caut") ? { color: "bg-warning text-background", label: "CAUTELOSO" } :
    { color: "bg-secondary text-foreground", label: decision || "—" };
  return <span className={`${cfg.color} text-[10px] font-bold px-2 py-1 rounded`}>{cfg.label}</span>;
}

export default function Recommendations() {
  const { data, isLoading } = trpc.matchAnalysis.adviceHistory.useQuery({ limit: 100 });
  const [q, setQ] = useState("");

  const rows: any[] = data ?? [];
  const filtered = q
    ? rows.filter((r) =>
        `${r.home} ${r.away} ${r.outcome} ${r.market} ${r.advice}`.toLowerCase().includes(q.toLowerCase()),
      )
    : rows;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-primary" /> Recomendações do Consultor IA
          </h1>
          <p className="text-muted-foreground text-sm">
            Histórico de todas as orientações que você pediu sobre sinais de apostas.
          </p>
        </div>

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por time, mercado, palavra-chave..."
            className="pl-9 bg-secondary border-border"
          />
        </div>

        {isLoading && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent>
          </Card>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {rows.length === 0
                ? <>Nenhuma recomendação ainda. Vá em <a href="/signals" className="text-primary underline">Sinais ao Vivo</a>, clique "Analisar partida" em qualquer sinal e peça uma orientação ao consultor.</>
                : "Nada bate o filtro."}
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {filtered.map((r) => {
            const p = parseAdvice(r.advice);
            return (
              <Card key={r.id} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <DecisionBadge decision={p.decisao} />
                      <p className="text-sm font-medium text-foreground">
                        {r.home} × {r.away}
                        <span className="text-muted-foreground"> · {r.market} → </span>
                        <span className="text-primary">{r.outcome}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.edgePct && <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30 text-[10px]">edge {parseFloat(r.edgePct).toFixed(1)}%</Badge>}
                      {r.bestPrice && r.bestBook && <Badge variant="outline" className="text-[10px]">{parseFloat(r.bestPrice).toFixed(2)} @ {r.bestBook}</Badge>}
                      <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  {p.tamanho && <p className="text-xs text-muted-foreground">Stake sugerido: <strong className="text-foreground">{p.tamanho}</strong></p>}
                  {p.aposta && p.aposta !== "-" && (
                    <div className={`p-2 rounded ${(p.decisao || "").toLowerCase().startsWith("sim") ? "bg-profit/10 border border-profit/30" : "bg-secondary/40"}`}>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Aposta sugerida</p>
                      <p className="text-xs text-foreground font-medium">{p.aposta}</p>
                    </div>
                  )}
                  {p.alternativo && p.alternativo !== "-" && <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">Alternativa:</strong> {p.alternativo}</p>}
                  {p.risco && <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">Risco:</strong> {p.risco}</p>}
                  {p.resumo && <p className="text-[11px] text-muted-foreground italic">{p.resumo}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
