import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radar, Plus, X, Search, Loader2, TrendingUp, TrendingDown, Minus, Clock, Trophy } from "lucide-react";
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
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Radar className="w-7 h-7 text-primary" /> Oportunidades
          </h1>
          <p className="text-muted-foreground">Descubra tendências em ações e value bets em esportes — análise transparente, sem caixa-preta</p>
        </div>

        <Tabs defaultValue="acoes">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="acoes"><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Ações (B3)</TabsTrigger>
            <TabsTrigger value="esportes"><Trophy className="w-3.5 h-3.5 mr-1.5" /> Esportes</TabsTrigger>
          </TabsList>
          <TabsContent value="acoes" className="mt-6 space-y-6"><StocksPanel /></TabsContent>
          <TabsContent value="esportes" className="mt-6 space-y-6"><SportsPanel /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ----- Ações / B3 -----
function StocksPanel() {
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
    <>
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
    </>
  );
}

// ----- Esportes / Value Bets -----
type ValueBet = { event: string; commence: string; market: string; outcome: string; point?: number; bestBook: string; bestPrice: number; avgPrice: number; booksCount: number; edgePct: number };
type Sport = { key: string; title: string; group: string };

type Provider = "the-odds-api" | "odds-api-io";

function SportsPanel() {
  const { data: cfg } = trpc.odds.configured.useQuery();
  const { data: cfgIo } = trpc.oddsIo.configured.useQuery();

  // Pick a default provider based on what's configured (prefer The Odds API
  // since its scanner shape is verified).
  const [provider, setProvider] = useState<Provider>("the-odds-api");
  // Re-sync default when configs load.
  if (cfg !== undefined && cfgIo !== undefined) {
    if (!cfg.configured && cfgIo.configured && provider === "the-odds-api") {
      // do nothing on every render — only flip once
    }
  }

  const sportsTheOdds = trpc.odds.sports.useQuery(undefined, { enabled: provider === "the-odds-api" && !!cfg?.configured });
  const sportsOddsIo = trpc.oddsIo.sports.useQuery(undefined, { enabled: provider === "odds-api-io" && !!cfgIo?.configured });

  const [sport, setSport] = useState<string>("");
  const [league, setLeague] = useState<string>("");
  const [edgeMin, setEdgeMin] = useState<string>("3");
  const [bets, setBets] = useState<ValueBet[] | null>(null);

  // Leagues only matter for Odds-API.io (The Odds API embeds the league in
  // the "sport" key itself, e.g. soccer_brazil_campeonato). Without a league
  // filter on Odds-API.io the /events list mixes 5000+ obscure leagues that
  // the user's 2-bookmaker free plan can't cover.
  const leaguesQuery = trpc.oddsIo.leagues.useQuery(
    { sport },
    { enabled: provider === "odds-api-io" && !!sport && !!cfgIo?.configured },
  );
  const leagues: { slug: string; name: string }[] = leaguesQuery.data?.leagues ?? [];

  const searchTheOdds = trpc.odds.opportunities.useMutation({
    onSuccess: (r) => {
      if (r.configured === false) { setBets(null); toast.error(r.message || "Configure ODDS_API_KEY."); return; }
      setBets(r.valueBets as ValueBet[]);
      if ((r.valueBets as ValueBet[]).length === 0) toast.message("Nenhum value bet acima do limite.");
    },
    onError: () => toast.error("Falha ao buscar. Verifique sua cota da API."),
  });
  const searchOddsIo = trpc.oddsIo.opportunities.useMutation({
    onSuccess: (r) => {
      if (r.configured === false) { setBets(null); toast.error(r.message || "Configure o token do Odds-API.io."); return; }
      if (r.message) toast.error(r.message);
      setBets(r.valueBets as ValueBet[]);
      if ((r.valueBets as ValueBet[]).length === 0 && !r.message) toast.message(`Nenhum value bet acima do limite (${r.eventCount} eventos analisados).`);
    },
    onError: () => toast.error("Falha ao buscar."),
  });

  const sportsData: any = provider === "the-odds-api" ? sportsTheOdds.data : sportsOddsIo.data;
  const sports: Sport[] = sportsData?.sports ?? [];
  const groupedSports = sports.reduce<Record<string, Sport[]>>((acc, s) => {
    (acc[s.group] = acc[s.group] || []).push(s); return acc;
  }, {});

  const search = provider === "the-odds-api" ? searchTheOdds : searchOddsIo;
  const isPending = search.isPending;

  const run = () => {
    if (!sport) return toast.error("Escolha um esporte.");
    setBets(null);
    const edgeThresholdPct = parseFloat(edgeMin) || 3;
    if (provider === "the-odds-api") {
      searchTheOdds.mutate({ sport, regions: "eu,uk", markets: "h2h", edgeThresholdPct });
    } else {
      searchOddsIo.mutate({ sport, league: league || undefined, edgeThresholdPct });
    }
  };

  const noneConfigured = cfg !== undefined && cfgIo !== undefined && !cfg.configured && !cfgIo.configured;
  if (noneConfigured) {
    return (
      <Card className="bg-warning/5 border-warning/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Clock className="w-4 h-4 text-warning mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum feed de odds configurado</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Em <a className="underline text-primary" href="/integrations">Integrações</a>, cole o token de pelo menos um dos provedores:
              <strong> The Odds API</strong> (the-odds-api.com, ~500 req/mês) ou <strong>Odds-API.io</strong> (100 req/hora, sem cartão).
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-3"><CardTitle className="text-base">Buscar value bets</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Provider selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Provedor de odds</Label>
            <div className="flex gap-2">
              <button
                onClick={() => { setProvider("the-odds-api"); setSport(""); setLeague(""); setBets(null); }}
                disabled={!cfg?.configured}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-all ${provider === "the-odds-api" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"} ${!cfg?.configured ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                The Odds API {!cfg?.configured && "(não configurado)"}
              </button>
              <button
                onClick={() => { setProvider("odds-api-io"); setSport(""); setLeague(""); setBets(null); }}
                disabled={!cfgIo?.configured}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-all ${provider === "odds-api-io" ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground"} ${!cfgIo?.configured ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Odds-API.io {!cfgIo?.configured && "(não configurado)"}
              </button>
            </div>
          </div>

          <div className={`grid gap-3 sm:items-end ${provider === "odds-api-io" ? "sm:grid-cols-[1fr_1fr_140px_auto]" : "sm:grid-cols-[1fr_140px_auto]"}`}>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Esporte</Label>
              <Select value={sport} onValueChange={(v) => { setSport(v); setLeague(""); }}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder={sports.length === 0 ? "Carregando esportes..." : "Escolha um esporte..."} /></SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedSports).map(([group, items]) => (
                    <div key={group}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{group}</div>
                      {items.map(s => <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {provider === "odds-api-io" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Liga {leaguesQuery.isFetching && <Loader2 className="w-3 h-3 inline animate-spin ml-1" />}
                </Label>
                <Select value={league || "__all__"} onValueChange={(v) => setLeague(v === "__all__" ? "" : v)} disabled={!sport || leagues.length === 0}>
                  <SelectTrigger className="bg-secondary border-border">
                    <SelectValue placeholder={!sport ? "Escolha um esporte primeiro" : leagues.length === 0 ? "Carregando ligas..." : "Todas as ligas"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as ligas</SelectItem>
                    {leagues.map(l => <SelectItem key={l.slug} value={l.slug}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Edge mínimo (%)</Label>
              <Input type="number" min="0" max="50" step="0.5" value={edgeMin} onChange={(e) => setEdgeMin(e.target.value)} className="bg-secondary border-border" />
            </div>
            <Button onClick={run} disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buscando...</> : <><Search className="w-4 h-4 mr-2" /> Buscar</>}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Compara a melhor odd vs. a média entre casas. Edge = quanto a melhor odd está acima da média — quanto maior, melhor o value.
            {provider === "the-odds-api" && " Regiões EU/UK incluem Bet365, Betano, Sportingbet."}
            {provider === "odds-api-io" && " Dica: filtre por uma liga grande (Brasileirão, Premier League) — as 2 casas do plano free não cobrem ligas regionais obscuras."}
          </p>
        </CardContent>
      </Card>

      {bets && bets.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3"><CardTitle className="text-base">Value Bets encontrados</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {bets.map((b, i) => (
                <div key={`${b.event}-${i}`} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-xs">+{b.edgePct.toFixed(1)}%</Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">{b.event}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.market.toUpperCase()} · <span className="text-foreground">{b.outcome}</span>{b.point != null && ` (${b.point})`}
                        {" · "}{new Date(b.commence).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-profit">{b.bestPrice.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">@ {b.bestBook}</span></p>
                    <p className="text-[11px] text-muted-foreground">média {b.avgPrice.toFixed(2)} · {b.booksCount} casas</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Não é previsão. Mostra discrepâncias entre casas — você ainda precisa avaliar a aposta e executar manualmente. Use stake fixo e respeite o caixa de especulação do alocador.
            </p>
          </CardContent>
        </Card>
      )}

      {bets && bets.length === 0 && (
        <Card className="bg-card border-border"><CardContent className="p-6 text-center text-sm text-muted-foreground">Nenhum value bet acima do edge mínimo. Tente reduzir o filtro ou outro esporte.</CardContent></Card>
      )}
    </>
  );
}
