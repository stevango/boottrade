import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Play, Pause, TrendingUp, Shield, Zap, Eye } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

const robots = [
  { id: 1, name: "Athena AI", slug: "athena-ai", market: "indices", marketLabel: "Mini Índice", status: "active", winRate: 82.5, totalReturn: 18.5, drawdown: 3.2, profitFactor: 2.45, iaScore: 9.2, monthlyReturn: 4.8, riskLevel: "medium", totalTrades: 1247 },
  { id: 2, name: "Kraken AI", slug: "kraken-ai", market: "cripto", marketLabel: "Criptomoedas", status: "active", winRate: 75.3, totalReturn: 24.2, drawdown: 5.8, profitFactor: 1.98, iaScore: 8.7, monthlyReturn: 6.1, riskLevel: "high", totalTrades: 892 },
  { id: 3, name: "Odin AI", slug: "odin-ai", market: "forex", marketLabel: "Forex", status: "paused", winRate: 71.8, totalReturn: 12.8, drawdown: 2.1, profitFactor: 2.12, iaScore: 8.4, monthlyReturn: 3.2, riskLevel: "low", totalTrades: 2103 },
  { id: 4, name: "Titan AI", slug: "titan-ai", market: "daytrade", marketLabel: "Day Trade", status: "active", winRate: 79.1, totalReturn: 15.3, drawdown: 4.5, profitFactor: 2.31, iaScore: 8.9, monthlyReturn: 3.8, riskLevel: "medium", totalTrades: 1589 },
  { id: 5, name: "Oracle AI", slug: "oracle-ai", market: "apostas", marketLabel: "Apostas Esportivas", status: "testing", winRate: 68.4, totalReturn: 8.7, drawdown: 6.2, profitFactor: 1.72, iaScore: 7.8, monthlyReturn: 2.9, riskLevel: "high", totalTrades: 456 },
  { id: 6, name: "Quantum AI", slug: "quantum-ai", market: "dolar", marketLabel: "Mini Dólar", status: "active", winRate: 76.9, totalReturn: 16.1, drawdown: 3.8, profitFactor: 2.18, iaScore: 8.6, monthlyReturn: 4.0, riskLevel: "medium", totalTrades: 1834 },
  { id: 7, name: "Pulse AI", slug: "pulse-ai", market: "acoes", marketLabel: "Ações", status: "paused", winRate: 73.2, totalReturn: 11.4, drawdown: 2.9, profitFactor: 1.95, iaScore: 8.1, monthlyReturn: 2.8, riskLevel: "low", totalTrades: 967 },
  { id: 8, name: "Nexus AI", slug: "nexus-ai", market: "cripto", marketLabel: "Arbitragem Cripto", status: "active", winRate: 91.2, totalReturn: 9.8, drawdown: 1.2, profitFactor: 3.45, iaScore: 9.5, monthlyReturn: 2.4, riskLevel: "low", totalTrades: 3421 },
];

const statusConfig = {
  active: { label: "Ativo", color: "bg-profit/10 text-profit border-profit/20" },
  paused: { label: "Pausado", color: "bg-warning/10 text-warning border-warning/20" },
  testing: { label: "Testando", color: "bg-primary/10 text-primary border-primary/20" },
  archived: { label: "Arquivado", color: "bg-muted text-muted-foreground border-border" },
};

const riskConfig = {
  low: { label: "Baixo", color: "text-profit" },
  medium: { label: "Médio", color: "text-warning" },
  high: { label: "Alto", color: "text-loss" },
  extreme: { label: "Extremo", color: "text-loss" },
};

export default function Robots() {
  const [activeTab, setActiveTab] = useState("all");

  const filteredRobots = activeTab === "all"
    ? robots
    : robots.filter((r) => r.market === activeTab);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Meus Robôs</h1>
            <p className="text-muted-foreground">Gerencie e monitore seus robôs de trading</p>
          </div>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Bot className="w-4 h-4 mr-2" /> Novo Robô
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="dolar">Dólar</TabsTrigger>
            <TabsTrigger value="acoes">Ações</TabsTrigger>
            <TabsTrigger value="daytrade">Day Trade</TabsTrigger>
            <TabsTrigger value="cripto">Cripto</TabsTrigger>
            <TabsTrigger value="forex">Forex</TabsTrigger>
            <TabsTrigger value="apostas">Apostas</TabsTrigger>
            <TabsTrigger value="indices">Índices</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRobots.map((robot) => (
                <Card key={robot.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300 group">
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{robot.name}</p>
                          <p className="text-xs text-muted-foreground">{robot.marketLabel}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={statusConfig[robot.status as keyof typeof statusConfig].color}>
                        {statusConfig[robot.status as keyof typeof statusConfig].label}
                      </Badge>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                        <p className="text-sm font-bold text-foreground">{robot.winRate}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Retorno</p>
                        <p className="text-sm font-bold text-profit">+{robot.totalReturn}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Drawdown</p>
                        <p className="text-sm font-bold text-loss">-{robot.drawdown}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">IA Score</p>
                        <p className="text-sm font-bold text-primary">{robot.iaScore}</p>
                      </div>
                    </div>

                    {/* Risk & PF */}
                    <div className="flex items-center justify-between text-xs mb-4">
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span className="text-muted-foreground">Risco:</span>
                        <span className={riskConfig[robot.riskLevel as keyof typeof riskConfig].color}>
                          {riskConfig[robot.riskLevel as keyof typeof riskConfig].label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Zap className="w-3 h-3 text-primary" />
                        <span className="text-muted-foreground">PF: {robot.profitFactor}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link href={`/robots/${robot.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full border-border hover:bg-secondary">
                          <Eye className="w-3 h-3 mr-1" /> Detalhes
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        className={robot.status === "active" ? "border-warning/30 text-warning hover:bg-warning/10" : "border-profit/30 text-profit hover:bg-profit/10"}
                      >
                        {robot.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
