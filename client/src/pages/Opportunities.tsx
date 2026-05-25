import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radar, Plus, X, Search, Loader2, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const trendStyle: Record<string, { label: string; className: string; Icon: typeof TrendingUp }> = {
  alta: { label: "Alta", className: "bg-profit/10 text-profit border-profit/20", Icon: TrendingUp },
  baixa: { label: "Baixa", className: "bg-loss/10 text-loss border-loss/20", Icon: TrendingDown },
  lateral: { label: "Lateral", className: "bg-secondary text-muted-foreground border-border", Icon: Minus },
};

const SUGGESTIONS = ["GOLD11", "PETR4", "VALE3", "IVVB11", "BOVA11", "ITUB4"];

type ScanRow = { symbol: string; name: string; trend: string; trendStrength: number; oneYear: number | null; lastPrice: number; score: number; error?: string };

export default function Opportunities() {
  const utils = trpc.useUtils();
  const { data: items } = trpc.watchlist.list.useQuery();
  const [symbol, setSymbol] = useState("");
  const [range, setRange] = useState<"1y" | "5y" | "10y">("5y");
  const [results, setResults] = useState<ScanRow[] | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);

  const addMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => { utils.watchlist.list.invalidate(); setSymbol(""); },
    onError: () => toast.error("Não foi possível adicionar."),
  });
  const removeMutation = trpc.watchlist.remove.useMutation({
    onSuccess: () => utils.watchlist.list.invalidate(),
  });
  const scanMutation = trpc.market.scan.useMutation({
    onSuccess: (r) => {
      if (r.configured === false) { setNotConfigured(true); setResults(null); return; }
      setNotConfigured(false);
      setResults(r.results as ScanRow[]);
    },
    onError: () => toast.error("Falha ao escanear."),
  });

  const list = items ?? [];
  const add = (s: string) => { if (s.trim()) addMutation.mutate({ symbol: s.trim().toUpperCase() }); };
  const scan = () => {
    const symbols = list.map((i: any) => i.symbol);
    if (symbols.length === 0) return toast.error("Adicione ao menos um ativo à watchlist.");
    scanMutation.mutate({ symbols, range });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-7 h-7 text-primary" /> Oportunidades
          </h1>
          <p className="text-muted-foreground">Monitore uma lista de ativos e descubra quais estão em tendência — ranqueados por força</p>
        </div>

        {/* Watchlist management */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Sua Watchlist</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="Adicionar ativo (ex.: GOLD11)" className="bg-secondary border-border" onKeyDown={(e) => e.key === "Enter" && add(symbol)} />
              <Button onClick={() => add(symbol)} disabled={addMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4" /></Button>
            </div>

            {list.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Sua watchlist está vazia. Sugestões:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => add(s)} className="px-2.5 py-1 rounded-full text-xs border border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors">+ {s}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {list.map((i: any) => (
                  <span key={i.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-secondary border border-border text-foreground">
                    {i.symbol}
                    <button onClick={() => removeMutation.mutate({ id: i.id })} className="text-muted-foreground hover:text-loss"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <div className="flex gap-1">
                {(["1y", "5y", "10y"] as const).map(r => (
                  <button key={r} onClick={() => setRange(r)} className={`px-3 py-1.5 rounded-lg text-xs border ${range === r ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"}`}>{r === "1y" ? "1A" : r === "5y" ? "5A" : "10A"}</button>
                ))}
              </div>
              <Button onClick={scan} disabled={scanMutation.isPending || list.length === 0} className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                {scanMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Escaneando...</> : <><Search className="w-4 h-4 mr-2" /> Escanear Tendências</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {notConfigured && (
          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Feed de mercado não configurado</p>
                <p className="text-xs text-muted-foreground mt-1">Defina <code className="text-primary">BRAPI_TOKEN</code> no servidor (token gratuito em brapi.dev) para escanear tendências com dados reais.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {results && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Ranking de Tendência</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {results.map((r, i) => {
                  const t = trendStyle[r.trend];
                  return (
                    <div key={r.symbol + i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.symbol} <span className="text-xs text-muted-foreground">{r.name !== r.symbol ? `· ${r.name}` : ""}</span></p>
                          {r.error ? (
                            <p className="text-xs text-loss">{r.error}</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">R$ {r.lastPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · força {r.trendStrength}%</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {r.oneYear !== null && (
                          <span className={`text-xs font-medium ${r.oneYear >= 0 ? "text-profit" : "text-loss"}`}>12m: {r.oneYear >= 0 ? "+" : ""}{r.oneYear.toFixed(1)}%</span>
                        )}
                        {t && !r.error && <Badge variant="outline" className={t.className}><t.Icon className="w-3 h-3 mr-1" /> {t.label}</Badge>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Análise descritiva de tendência (médias móveis + retornos históricos). Não é previsão nem recomendação de compra/venda.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
