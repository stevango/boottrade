import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

type Broker = "paper" | "clear" | "ibkr" | "mercado_bitcoin";

const BROKER_LABELS: Record<Broker, string> = {
  paper: "🧪 Paper Trading",
  clear: "💼 Clear",
  ibkr: "🌎 Interactive Brokers",
  mercado_bitcoin: "₿ Mercado Bitcoin",
};

export default function BrokerPortfolio() {
  const [broker, setBroker] = useState<Broker>("paper");
  const acc = trpc.oms.accountSnapshot.useQuery({ broker }, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();

  const fmtBrl = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCcy = (n: number, ccy: string) => `${ccy === "BRL" ? "R$" : ccy === "USD" ? "$" : ccy} ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const tone = (n: number) => n > 0 ? "text-profit" : n < 0 ? "text-loss" : "text-muted-foreground";

  const a: any = acc.data;
  const hasError = a && "error" in a;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Wallet className="w-7 h-7 text-primary" /> Carteira do Broker
            </h1>
            <p className="text-muted-foreground text-sm">
              Posições e saldo em cada corretora conectada. Atualiza sozinho a cada 30s.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => utils.oms.accountSnapshot.invalidate()}>
            {acc.isFetching ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Recarregar
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(Object.keys(BROKER_LABELS) as Broker[]).map((b) => (
            <button key={b}
              onClick={() => setBroker(b)}
              className={`px-4 py-2 rounded-lg text-xs border transition-colors ${broker === b ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"}`}>
              {BROKER_LABELS[b]}
            </button>
          ))}
        </div>

        {acc.isLoading && (
          <Card className="bg-card border-border"><CardContent className="p-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
        )}

        {hasError && (
          <Card className="bg-loss/5 border-loss/30">
            <CardContent className="p-4">
              <p className="text-sm text-loss font-medium">⚠ Erro ao buscar conta</p>
              <p className="text-xs text-muted-foreground mt-1">{a.error}</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                Confirma que conectou {BROKER_LABELS[broker]} em <a className="text-primary underline" href="/integrations">Integrações</a>.
              </p>
            </CardContent>
          </Card>
        )}

        {!acc.isLoading && !hasError && a && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo disponível</p>
                  <p className="text-xl font-bold text-foreground">{fmtCcy(a.cashAvailable, a.currency)}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Patrimônio total</p>
                  <p className="text-xl font-bold text-foreground">{fmtCcy(a.totalEquity, a.currency)}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Posições</p>
                  <p className="text-xl font-bold text-foreground">{a.positions?.length ?? 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Moeda</p>
                  <p className="text-xl font-bold text-foreground">{a.currency}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-3">Posições</p>
                {(a.positions ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhuma posição aberta. {broker === "paper" ? "Ative Athena AI e rode pra começar a popular." : "Aguardando ordens executarem."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(a.positions ?? []).map((p: any, i: number) => {
                      const pnl = p.unrealizedPnl ?? null;
                      return (
                        <div key={i} className="p-3 rounded bg-secondary/30 flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="text-xs font-mono">{p.asset.symbol}</Badge>
                            <p className="text-sm text-foreground">
                              <strong>{p.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</strong> @ {fmtCcy(p.averageEntryPrice, a.currency)}
                            </p>
                            {p.marketValue != null && (
                              <p className="text-xs text-muted-foreground">
                                Mkt: {fmtCcy(p.marketValue, a.currency)}
                              </p>
                            )}
                          </div>
                          {pnl !== null && (
                            <div className={`flex items-center gap-1 text-sm font-medium ${tone(pnl)}`}>
                              {pnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              {pnl >= 0 ? "+" : ""}{fmtCcy(pnl, a.currency)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
