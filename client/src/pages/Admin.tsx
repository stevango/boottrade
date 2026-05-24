import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Bot, DollarSign, BarChart3, Shield, TrendingUp, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const revenueData = [
  { month: "Jan", revenue: 12500 },
  { month: "Fev", revenue: 15800 },
  { month: "Mar", revenue: 18200 },
  { month: "Abr", revenue: 21500 },
  { month: "Mai", revenue: 24800 },
  { month: "Jun", revenue: 28100 },
];

const usersGrowth = [
  { month: "Jan", users: 450 },
  { month: "Fev", users: 680 },
  { month: "Mar", users: 920 },
  { month: "Abr", users: 1350 },
  { month: "Mai", users: 1890 },
  { month: "Jun", users: 2540 },
];

const recentUsers = [
  { id: 1, name: "Carlos Silva", email: "carlos@email.com", plan: "pro", status: "active", joined: "22/05/2026" },
  { id: 2, name: "Ana Souza", email: "ana@email.com", plan: "starter", status: "active", joined: "21/05/2026" },
  { id: 3, name: "Pedro Costa", email: "pedro@email.com", plan: "institutional", status: "active", joined: "20/05/2026" },
  { id: 4, name: "Maria Oliveira", email: "maria@email.com", plan: "pro", status: "suspended", joined: "19/05/2026" },
  { id: 5, name: "João Santos", email: "joao@email.com", plan: "starter", status: "active", joined: "18/05/2026" },
];

const marketplaceRobots = [
  { id: 1, name: "Athena Pro v3", creator: "QuantMaster", subscribers: 1250, revenue: 18735, status: "approved" },
  { id: 2, name: "Crypto Sniper", creator: "BlockchainPro", subscribers: 890, revenue: 17811, status: "approved" },
  { id: 3, name: "New Strategy X", creator: "NewTrader", subscribers: 0, revenue: 0, status: "pending" },
  { id: 4, name: "Forex Eagle", creator: "FXTrader", subscribers: 670, revenue: 6693, status: "approved" },
];

const planColors = {
  starter: "bg-muted text-muted-foreground",
  pro: "bg-primary/10 text-primary",
  institutional: "bg-warning/10 text-warning",
};

export default function Admin() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie a plataforma e monitore métricas</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Usuários</p>
                  <p className="text-xl font-bold text-foreground">2,540</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-profit/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-profit" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Receita Mensal</p>
                  <p className="text-xl font-bold text-foreground">R$ 28.1k</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-chart-3" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Robôs Ativos</p>
                  <p className="text-xl font-bold text-foreground">48</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Trades Hoje</p>
                  <p className="text-xl font-bold text-foreground">1,234</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Receita Mensal</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={revenueData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                      <XAxis dataKey="month" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                      <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#00d4aa" strokeWidth={2} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Crescimento de Usuários</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={usersGrowth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 260 / 0.5)" />
                      <XAxis dataKey="month" stroke="oklch(0.65 0.02 260)" fontSize={12} />
                      <YAxis stroke="oklch(0.65 0.02 260)" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "oklch(0.16 0.012 260)", border: "1px solid oklch(0.25 0.015 260)", borderRadius: "8px" }} />
                      <Bar dataKey="users" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usuários Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
                          {user.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className={planColors[user.plan as keyof typeof planColors]}>
                          {user.plan}
                        </Badge>
                        <Badge variant="outline" className={user.status === "active" ? "text-profit border-profit/20" : "text-loss border-loss/20"}>
                          {user.status === "active" ? "Ativo" : "Suspenso"}
                        </Badge>
                        <span className="text-xs text-muted-foreground hidden sm:block">{user.joined}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="marketplace" className="mt-6">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Robôs no Marketplace</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {marketplaceRobots.map((robot) => (
                    <div key={robot.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bot className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{robot.name}</p>
                          <p className="text-xs text-muted-foreground">por {robot.creator} • {robot.subscribers} assinantes</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground hidden sm:block">R$ {robot.revenue.toLocaleString()}</span>
                        <Badge variant="outline" className={robot.status === "approved" ? "text-profit border-profit/20" : "text-warning border-warning/20"}>
                          {robot.status === "approved" ? "Aprovado" : "Pendente"}
                        </Badge>
                        {robot.status === "pending" && (
                          <Button size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
                            Revisar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
