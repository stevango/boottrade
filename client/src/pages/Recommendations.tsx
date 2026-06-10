import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

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
          {filtered.map((r) => (
            <Card key={r.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-sm font-medium text-foreground">
                    {r.home} × {r.away}
                    <span className="text-muted-foreground"> · {r.market} → </span>
                    <span className="text-primary">{r.outcome}</span>
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.edgePct && <Badge variant="outline" className="bg-profit/10 text-profit border-profit/30 text-[10px]">edge {parseFloat(r.edgePct).toFixed(1)}%</Badge>}
                    {r.bestPrice && r.bestBook && <Badge variant="outline" className="text-[10px]">{parseFloat(r.bestPrice).toFixed(2)} @ {r.bestBook}</Badge>}
                    <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed bg-secondary/30 p-3 rounded">{r.advice}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
