import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TrendingUp, TrendingDown, DollarSign, Activity, Play, RotateCcw, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const MARKETS = [
  { id: "dolar", label: "Dólar" },
  { id: "acoes", label: "Ações" },
  { id: "daytrade", label: "Day Trade" },
  { id: "cripto", label: "Cripto" },
  { id: "indices", label: "Índices" },
  { id: "forex", label: "Forex" },
  { id: "apostas", label: "Apostas" },
] as const;

type Market = (typeof MARKETS)[number]["id"];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PaperTrade() {
  const utils = trpc.useUtils();
  const { data: paperTrades, isLoading } = trpc.paper.list.useQuery();
  const { data: stats } = trpc.paper.stats.useQuery();

  const invalidate = () => {
    utils.paper.list.invalidate();
    utils.paper.stats.invalidate();
  };

  const openMutation = trpc.paper.open.useMutation({
    onSuccess: () => { toast.success("Operação aberta!"); invalidate(); setNewOpen(false); resetForm(); },
    onError: () => toast.error("Não foi possível abrir a operação."),
  });
  const closeMutation = trpc.paper.close.useMutation({
    onSuccess: (r) => {
      const profit = r && "profit" in r ? r.profit ?? 0 : 0;
      toast.success(`Operação fechada (${profit >= 0 ? "+" : ""}R$ ${fmtBRL(profit)})`);
      invalidate();
      setCloseTarget(null);
    },
    onError: () => toast.error("Não foi possível fechar a operação."),
  });
  const resetMutation = trpc.paper.reset.useMutation({
    onSuccess: () => { toast.success("Conta de paper trade resetada."); invalidate(); },
  });

  // New-trade form state
  const [newOpen, setNewOpen] = useState(false);
  const [market, setMarket] = useState<Market>("dolar");
  const [asset, setAsset] = useState("");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");

  const resetForm = () => {
    setAsset(""); setQuantity(""); setEntryPrice(""); setStopLoss(""); setTakeProfit(""); setType("buy"); setMarket("dolar");
  };

  const handleOpen = () => {
    const qty = parseFloat(quantity);
    const entry = parseFloat(entryPrice);
    if (!asset.trim()) return toast.error("Informe o ativo.");
    if (!(qty > 0)) return toast.error("Quantidade deve ser maior que zero.");
    if (!(entry > 0)) return toast.error("Preço de entrada deve ser maior que zero.");
    openMutation.mutate({
      asset: asset.trim().toUpperCase(),
      market,
      type,
      quantity: qty,
      entryPrice: entry,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
    });
  };

  // Close-trade dialog state
  const [closeTarget, setCloseTarget] = useState<{ id: number; asset: string; entry: number } | null>(null);
  const [exitPrice, setExitPrice] = useState("");

  const handleClose = () => {
    if (!closeTarget) return;
    const exit = parseFloat(exitPrice);
    if (!(exit > 0)) return toast.error("Preço de saída deve ser maior que zero.");
    closeMutation.mutate({ id: closeTarget.id, exitPrice: exit });
  };

  const rows = paperTrades ?? [];
  const startCapital = stats?.startCapital ?? 100000;
  const equity = stats?.equity ?? startCapital;
  const equityPct = startCapital > 0 ? ((equity - startCapital) / startCapital) * 100 : 0;

  // Equity curve from closed trades (chronological), cumulative from start capital.
  const equityData = useMemo(() => {
    const closed = rows
      .filter(t => t.status === "closed" && t.closedAt)
      .sort((a, b) => new Date(a.closedAt!).getTime() - new Date(b.closedAt!).getTime());
    if (closed.length === 0) return [];
    let cumulative = startCapital;
    const series = [{ trade: 0, equity: cumulative }];
    closed.forEach((t, i) => {
      cumulative += parseFloat(String(t.profit || "0"));
      series.push({ trade: i + 1, equity: cumulative });
    });
    return series;
  }, [rows, startCapital]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paper Trade</h1>
            <p className="text-muted-foreground">Simulador com capital virtual — sem risco real</p>
          </div>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-border" disabled={rows.length === 0 || resetMutation.isPending}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Resetar Conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-foreground">Resetar conta de paper trade?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as suas operações simuladas serão apagadas permanentemente e o capital virtual volta para R$ {fmtBRL(startCapital)}. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => resetMutation.mutate()} className="bg-loss hover:bg-loss/90 text-white">
                    Resetar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => setNewOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Play className="w-4 h-4 mr-2" /> Nova Operação
            </Button>
          </div>
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Capital Virtual</span>
              </div>
              <p className="text-xl font-bold text-foreground">R$ {fmtBRL(equity)}</p>
              <p className={`text-xs ${equityPct >= 0 ? "text-profit" : "text-loss"}`}>
                {equityPct >= 0 ? "+" : ""}{equityPct.toFixed(2)}% desde início
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className={`w-4 h-4 ${(stats?.todayPnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`} />
                <span className="text-sm text-muted-foreground">Resultado Hoje</span>
              </div>
              <p className={`text-xl font-bold ${(stats?.todayPnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                {(stats?.todayPnl ?? 0) >= 0 ? "+" : ""}R$ {fmtBRL(stats?.todayPnl ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{stats?.openCount ?? 0} aberta(s)</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {stats?.winRate != null ? `${stats.winRate.toFixed(1)}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">{stats?.closedCount ?? 0} fechada(s)</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={`w-4 h-4 ${(stats?.realizedPnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`} />
                <span className="text-sm text-muted-foreground">P&L Realizado</span>
              </div>
              <p className={`text-xl font-bold ${(stats?.realizedPnl ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                {(stats?.realizedPnl ?? 0) >= 0 ? "+" : ""}R$ {fmtBRL(stats?.realizedPnl ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">{stats?.totalTrades ?? 0} no total</p>
            </CardContent>
          </Card>
        </div>

        {/* Equity Curve */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Curva de Capital</CardTitle>
          </CardHeader>
          <CardContent>
            {equityData.length === 0 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-center gap-2">
                <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Sem operações fechadas ainda</p>
                <p className="text-xs text-muted-foreground/70">Abra e feche uma operação para ver a evolução do capital.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={equityData}>
                  <defs>
                    <linearGradient id="colorEq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                  <XAxis dataKey="trade" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                  <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }}
                    formatter={(value: number) => [`R$ ${fmtBRL(value)}`, "Capital"]}
                  />
                  <Area type="monotone" dataKey="equity" stroke="#00d4aa" strokeWidth={2} fill="url(#colorEq)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Trades */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Operações</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
                <Activity className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Nenhuma operação ainda</p>
                <p className="text-xs text-muted-foreground/70">Clique em "Nova Operação" para começar a simular.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((trade) => {
                  const profit = parseFloat(String(trade.profit || "0"));
                  const entry = parseFloat(String(trade.entryPrice || "0"));
                  const qty = parseFloat(String(trade.quantity || "0"));
                  const isOpen = trade.status === "open";
                  return (
                    <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOpen ? "bg-primary/10" : profit > 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                          {isOpen ? (
                            <Activity className="w-4 h-4 text-primary animate-pulse" />
                          ) : profit > 0 ? (
                            <TrendingUp className="w-4 h-4 text-profit" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-loss" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                          <p className="text-xs text-muted-foreground">
                            {trade.type === "buy" ? "Compra" : "Venda"} • Qtd: {qty} • Entrada: {entry}
                            {" • "}{new Date(trade.openedAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <>
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Aberta</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => { setCloseTarget({ id: trade.id, asset: trade.asset, entry }); setExitPrice(""); }}
                            >
                              Fechar
                            </Button>
                          </>
                        ) : (
                          <span className={`text-sm font-bold ${profit > 0 ? "text-profit" : "text-loss"}`}>
                            {profit > 0 ? "+" : ""}R$ {fmtBRL(profit)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Operation Dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Nova Operação Simulada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Mercado</Label>
                <Select value={market} onValueChange={(v) => setMarket(v as Market)}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARKETS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Direção</Label>
                <Select value={type} onValueChange={(v) => setType(v as "buy" | "sell")}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Compra</SelectItem>
                    <SelectItem value="sell">Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Ativo</Label>
              <Input value={asset} onChange={(e) => setAsset(e.target.value)} placeholder="Ex: WINFUT, PETR4, BTC/USD" className="bg-secondary border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Quantidade</Label>
                <Input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preço de Entrada</Label>
                <Input type="number" inputMode="decimal" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Stop Loss (opcional)</Label>
                <Input type="number" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Take Profit (opcional)</Label>
                <Input type="number" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleOpen} disabled={openMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {openMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Abrindo...</> : "Abrir Operação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Operation Dialog */}
      <Dialog open={closeTarget !== null} onOpenChange={(o) => !o && setCloseTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Fechar {closeTarget?.asset}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            <p className="text-xs text-muted-foreground">Preço de entrada: {closeTarget?.entry}</p>
            <Label className="text-sm text-muted-foreground">Preço de Saída</Label>
            <Input type="number" inputMode="decimal" autoFocus value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder="0,00" className="bg-secondary border-border" />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCloseTarget(null)}>Cancelar</Button>
            <Button onClick={handleClose} disabled={closeMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {closeMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fechando...</> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
