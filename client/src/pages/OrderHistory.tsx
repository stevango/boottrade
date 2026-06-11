import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  placed: "bg-primary/10 text-primary border-primary/30",
  won: "bg-profit/10 text-profit border-profit/30",
  lost: "bg-loss/10 text-loss border-loss/30",
  void: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30",
  cancelled: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/30",
  error: "bg-loss/10 text-loss border-loss/30",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  placed: "Enviada",
  won: "Ganhou",
  lost: "Perdeu",
  void: "Anulada",
  cancelled: "Cancelada",
  error: "Erro",
};

export default function OrderHistory() {
  const { data, isLoading, refetch, isFetching } = trpc.oms.orderHistory.useQuery({ limit: 200 }, { refetchInterval: 30_000 });
  const [filter, setFilter] = useState<string>("all");

  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tone = (n: number) => n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground";

  const orders = (data as any[]) ?? [];
  const filtered = filter === "all" ? orders : orders.filter((o: any) => o.status === filter);

  const totalStake = orders.reduce((s: number, o: any) => s + parseFloat(o.stake || "0"), 0);
  const totalProfit = orders.reduce((s: number, o: any) => s + parseFloat(o.profit || "0"), 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <FileText className="w-7 h-7 text-primary" /> Histórico de Ordens
            </h1>
            <p className="text-muted-foreground text-sm">
              Todas as ordens enviadas via OMS pra cada broker. Atualiza a cada 30s.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Recarregar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total apostado</p>
              <p className="text-xl font-bold text-foreground">{fmt(totalStake)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit líquido</p>
              <p className={`text-xl font-bold ${tone(totalProfit)}`}>{totalProfit >= 0 ? "+" : ""}{fmt(totalProfit)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total de ordens</p>
              <p className="text-xl font-bold text-foreground">{orders.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Liquidadas</p>
              <p className="text-xl font-bold text-foreground">{orders.filter((o: any) => o.status === "won" || o.status === "lost").length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2 flex-wrap">
          {["all", "pending", "placed", "won", "lost", "error", "cancelled"].map((f) => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/30 text-muted-foreground border-border hover:text-foreground"}`}>
              {f === "all" ? "Todos" : STATUS_LABEL[f] ?? f} ({f === "all" ? orders.length : orders.filter((o: any) => o.status === f).length})
            </button>
          ))}
        </div>

        {isLoading && (
          <Card className="bg-card border-border"><CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {orders.length === 0
                ? <>Nenhuma ordem ainda. Vá em <a className="text-primary underline" href="/integrations">Integrações</a> → OMS, ative modo Paper, depois ative Athena/Kraken AI pra gerar e executar sinais.</>
                : "Nenhuma ordem no filtro selecionado."}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {filtered.map((o: any) => {
            const profit = parseFloat(o.profit || "0");
            const stake = parseFloat(o.stake || "0");
            const price = parseFloat(o.price || "0");
            return (
              <Card key={o.id} className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[o.status]}`}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{o.bookmaker}</Badge>
                      <p className="text-sm text-foreground font-medium">
                        <span className="font-mono">{o.event}</span>
                        <span className="text-muted-foreground"> · {o.market} → </span>
                        <span className={o.outcome === "BUY" || o.outcome === "buy" ? "text-profit" : "text-loss"}>{o.outcome}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Stake: {fmt(stake)}</span>
                      {price > 0 && <span className="text-muted-foreground">Preço: {price.toFixed(2)}</span>}
                      {(o.status === "won" || o.status === "lost") && (
                        <span className={`font-medium flex items-center gap-1 ${tone(profit)}`}>
                          {profit >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {profit >= 0 ? "+" : ""}{fmt(profit)}
                        </span>
                      )}
                    </div>
                  </div>
                  {o.errorMessage && (
                    <p className="text-[11px] text-loss mt-1">{o.errorMessage}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                    <span>{o.source}</span>
                    <span>·</span>
                    <span>{new Date(o.placedAt).toLocaleString("pt-BR")}</span>
                    {o.betfairBetId && <><span>·</span><code className="text-[10px]">{o.betfairBetId}</code></>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
