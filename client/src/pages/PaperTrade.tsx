import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Activity, Play, RotateCcw, Trophy } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const equityData = Array.from({ length: 20 }, (_, i) => ({
  trade: i + 1,
  equity: 50000 + (Math.random() - 0.3) * 2000 * (i + 1),
}));

const paperTrades = [
  { id: 1, asset: "WINFUT", type: "buy", entry: 128450, exit: 128720, qty: 2, profit: 540, time: "14:32", status: "closed" },
  { id: 2, asset: "DOLFUT", type: "sell", entry: 5245.5, exit: 5238.0, qty: 5, profit: 375, time: "13:15", status: "closed" },
  { id: 3, asset: "BTC/USD", type: "buy", entry: 68420, exit: null, qty: 0.1, profit: 0, time: "12:45", status: "open" },
  { id: 4, asset: "PETR4", type: "buy", entry: 38.72, exit: 38.45, qty: 100, profit: -27, time: "11:20", status: "closed" },
  { id: 5, asset: "EUR/USD", type: "sell", entry: 1.0845, exit: 1.0812, qty: 10000, profit: 330, time: "10:05", status: "closed" },
];

const ranking = [
  { pos: 1, name: "TraderPro_BR", profit: 12450, winRate: 84.2, trades: 156 },
  { pos: 2, name: "AlphaQuant", profit: 9870, winRate: 78.9, trades: 203 },
  { pos: 3, name: "CryptoKing", profit: 8340, winRate: 71.5, trades: 89 },
  { pos: 4, name: "Você", profit: 6280, winRate: 75.3, trades: 124 },
  { pos: 5, name: "DayTrader99", profit: 5120, winRate: 69.8, trades: 178 },
];

export default function PaperTrade() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Paper Trade</h1>
            <p className="text-muted-foreground">Simulador de operações em tempo real</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border">
              <RotateCcw className="w-4 h-4 mr-2" /> Resetar Conta
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
              <p className="text-xl font-bold text-foreground">R$ 56.280</p>
              <p className="text-xs text-profit">+12.56% desde início</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-profit" />
                <span className="text-sm text-muted-foreground">Lucro Hoje</span>
              </div>
              <p className="text-xl font-bold text-profit">+R$ 1.218</p>
              <p className="text-xs text-muted-foreground">8 operações</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <p className="text-xl font-bold text-foreground">75.3%</p>
              <p className="text-xs text-muted-foreground">124 trades total</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-warning" />
                <span className="text-sm text-muted-foreground">Ranking</span>
              </div>
              <p className="text-xl font-bold text-foreground">#4</p>
              <p className="text-xs text-muted-foreground">de 2.547 traders</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Equity Curve */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Curva de Capital</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                  <Area type="monotone" dataKey="equity" stroke="#00d4aa" strokeWidth={2} fill="url(#colorEq)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Ranking */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" /> Ranking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ranking.map((trader) => (
                  <div key={trader.pos} className={`flex items-center justify-between p-2.5 rounded-lg ${trader.name === "Você" ? "bg-primary/10 border border-primary/20" : "bg-secondary/30"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold w-6 ${trader.pos <= 3 ? "text-warning" : "text-muted-foreground"}`}>#{trader.pos}</span>
                      <div>
                        <p className={`text-sm font-medium ${trader.name === "Você" ? "text-primary" : "text-foreground"}`}>{trader.name}</p>
                        <p className="text-xs text-muted-foreground">{trader.winRate}% WR</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-profit">+R${trader.profit.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trades History */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Operações do Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {paperTrades.map((trade) => (
                <div key={trade.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${trade.status === "open" ? "bg-primary/10" : trade.profit > 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                      {trade.status === "open" ? (
                        <Activity className="w-4 h-4 text-primary animate-pulse" />
                      ) : trade.profit > 0 ? (
                        <TrendingUp className="w-4 h-4 text-profit" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-loss" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                      <p className="text-xs text-muted-foreground">
                        {trade.type === "buy" ? "Compra" : "Venda"} • {trade.time} • Qtd: {trade.qty}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {trade.status === "open" ? (
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Aberta</Badge>
                    ) : (
                      <span className={`text-sm font-bold ${trade.profit > 0 ? "text-profit" : "text-loss"}`}>
                        {trade.profit > 0 ? "+" : ""}R$ {trade.profit.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
