import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Wallet, TrendingUp, TrendingDown, Plus, Building2, Bitcoin, BarChart3, Landmark, Globe } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const classLabels: Record<string, { label: string; icon: any; color: string }> = {
  acoes: { label: "Ações", icon: TrendingUp, color: "#00d4aa" },
  renda_fixa: { label: "Renda Fixa", icon: Landmark, color: "#7c3aed" },
  fundos: { label: "Fundos", icon: Building2, color: "#f59e0b" },
  cripto: { label: "Criptomoedas", icon: Bitcoin, color: "#f97316" },
  cdb: { label: "CDB/CDBi", icon: Landmark, color: "#06b6d4" },
  tesouro: { label: "Tesouro", icon: Landmark, color: "#10b981" },
  fii: { label: "FIIs", icon: Building2, color: "#8b5cf6" },
  internacional: { label: "Internacional", icon: Globe, color: "#ec4899" },
};

const riskLabels: Record<string, { label: string; color: string }> = {
  conservador: { label: "Conservador", color: "text-profit" },
  moderado: { label: "Moderado", color: "text-warning" },
  arrojado: { label: "Arrojado", color: "text-chart-4" },
  agressivo: { label: "Agressivo", color: "text-loss" },
};

const horizonLabels: Record<string, string> = {
  curto: "Curto Prazo",
  medio: "Médio Prazo",
  longo: "Longo Prazo",
};

export default function Portfolio() {
  const { data: assets, isLoading } = trpc.portfolio.list.useQuery();
  const addMutation = trpc.portfolio.add.useMutation({
    onSuccess: () => {
      toast.success("Ativo adicionado com sucesso!");
      setDialogOpen(false);
    },
  });
  const deleteMutation = trpc.portfolio.delete.useMutation({
    onSuccess: () => toast.success("Ativo removido."),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({
    assetClass: "acoes" as string,
    name: "",
    ticker: "",
    institution: "",
    totalInvested: 0,
    currentValue: 0,
    riskProfile: "moderado" as string,
    horizon: "medio" as string,
  });

  // Calculate totals
  const totalInvested = assets?.reduce((sum, a) => sum + parseFloat(String(a.totalInvested || "0")), 0) || 0;
  const totalCurrent = assets?.reduce((sum, a) => sum + parseFloat(String(a.currentValue || "0")), 0) || 0;
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? ((totalPnL / totalInvested) * 100) : 0;

  // Group by class for pie chart
  const classGroups = assets?.reduce((acc, a) => {
    const cls = a.assetClass;
    if (!acc[cls]) acc[cls] = 0;
    acc[cls] += parseFloat(String(a.currentValue || "0"));
    return acc;
  }, {} as Record<string, number>) || {};

  const pieData = Object.entries(classGroups).map(([key, value]) => ({
    name: classLabels[key]?.label || key,
    value,
    color: classLabels[key]?.color || "#666",
  }));

  const handleAddAsset = () => {
    if (!newAsset.name) {
      toast.error("Nome do ativo é obrigatório");
      return;
    }
    addMutation.mutate({
      assetClass: newAsset.assetClass as any,
      name: newAsset.name,
      ticker: newAsset.ticker || undefined,
      institution: newAsset.institution || undefined,
      totalInvested: newAsset.totalInvested || undefined,
      currentValue: newAsset.currentValue || undefined,
      riskProfile: newAsset.riskProfile as any,
      horizon: newAsset.horizon as any,
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha Carteira</h1>
            <p className="text-muted-foreground">Visão consolidada do patrimônio por classe de ativo</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Adicionar Ativo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Adicionar Ativo à Carteira</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Classe</Label>
                    <Select value={newAsset.assetClass} onValueChange={(v) => setNewAsset({ ...newAsset, assetClass: v })}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(classLabels).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Perfil de Risco</Label>
                    <Select value={newAsset.riskProfile} onValueChange={(v) => setNewAsset({ ...newAsset, riskProfile: v })}>
                      <SelectTrigger className="bg-secondary border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(riskLabels).map(([key, { label }]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Nome do Ativo</Label>
                  <Input value={newAsset.name} onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })} placeholder="Ex: PETR4, CDB Banco Inter, Bitcoin" className="bg-secondary border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Ticker</Label>
                    <Input value={newAsset.ticker} onChange={(e) => setNewAsset({ ...newAsset, ticker: e.target.value })} placeholder="PETR4" className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Instituição</Label>
                    <Input value={newAsset.institution} onChange={(e) => setNewAsset({ ...newAsset, institution: e.target.value })} placeholder="XP, Inter, Binance" className="bg-secondary border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Total Investido (R$)</Label>
                    <Input type="number" value={newAsset.totalInvested || ""} onChange={(e) => setNewAsset({ ...newAsset, totalInvested: parseFloat(e.target.value) || 0 })} className="bg-secondary border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Valor Atual (R$)</Label>
                    <Input type="number" value={newAsset.currentValue || ""} onChange={(e) => setNewAsset({ ...newAsset, currentValue: parseFloat(e.target.value) || 0 })} className="bg-secondary border-border" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Horizonte</Label>
                  <Select value={newAsset.horizon} onValueChange={(v) => setNewAsset({ ...newAsset, horizon: v })}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="curto">Curto Prazo</SelectItem>
                      <SelectItem value="medio">Médio Prazo</SelectItem>
                      <SelectItem value="longo">Longo Prazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAsset} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Adicionando..." : "Adicionar Ativo"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Patrimônio Total</p>
                  <p className="text-lg font-bold text-foreground">R$ {totalCurrent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Investido</p>
                  <p className="text-lg font-bold text-foreground">R$ {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalPnL >= 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                  {totalPnL >= 0 ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lucro/Prejuízo</p>
                  <p className={`text-lg font-bold ${totalPnL >= 0 ? "text-profit" : "text-loss"}`}>
                    {totalPnL >= 0 ? "+" : ""}R$ {totalPnL.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalPnLPercent >= 0 ? "bg-profit/10" : "bg-loss/10"}`}>
                  {totalPnLPercent >= 0 ? <TrendingUp className="w-5 h-5 text-profit" /> : <TrendingDown className="w-5 h-5 text-loss" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rentabilidade</p>
                  <p className={`text-lg font-bold ${totalPnLPercent >= 0 ? "text-profit" : "text-loss"}`}>
                    {totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pie Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Alocação por Classe</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Adicione ativos para ver a alocação</p>
                </div>
              )}
              <div className="space-y-2 mt-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                    </div>
                    <span className="text-foreground font-medium">R$ {entry.value.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Assets List */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ativos na Carteira</CardTitle>
              </CardHeader>
              <CardContent>
                {assets && assets.length > 0 ? (
                  <div className="space-y-2">
                    {assets.map((asset) => {
                      const cls = classLabels[asset.assetClass];
                      const pnl = parseFloat(String(asset.profitLoss || "0"));
                      const pnlPct = parseFloat(String(asset.profitPercent || "0"));
                      return (
                        <div key={asset.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cls?.color}15` }}>
                              {cls?.icon && <cls.icon className="w-5 h-5" style={{ color: cls.color }} />}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{asset.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {asset.ticker && <span>{asset.ticker}</span>}
                                {asset.institution && <span>• {asset.institution}</span>}
                                <Badge variant="outline" className="text-[10px]">{horizonLabels[asset.horizon]}</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">
                              R$ {parseFloat(String(asset.currentValue || "0")).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                            <p className={`text-xs font-medium ${pnl >= 0 ? "text-profit" : "text-loss"}`}>
                              {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum ativo na carteira.</p>
                    <p className="text-xs text-muted-foreground mt-1">Adicione seus investimentos para ter uma visão consolidada.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
