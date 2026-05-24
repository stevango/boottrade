import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trophy, Copy, TrendingUp, Heart, MessageCircle, Star, UserPlus } from "lucide-react";

const topTraders = [
  { id: 1, name: "QuantMaster", avatar: "Q", winRate: 84.2, monthlyReturn: 12.5, followers: 3420, trades: 1892, profit: 45200, rank: 1 },
  { id: 2, name: "AlphaTrader", avatar: "A", winRate: 81.7, monthlyReturn: 10.8, followers: 2890, trades: 2341, profit: 38900, rank: 2 },
  { id: 3, name: "CryptoKing", avatar: "C", winRate: 78.3, monthlyReturn: 15.2, followers: 2150, trades: 987, profit: 32100, rank: 3 },
  { id: 4, name: "FXMaster", avatar: "F", winRate: 76.9, monthlyReturn: 8.4, followers: 1870, trades: 3102, profit: 28700, rank: 4 },
  { id: 5, name: "DayPro", avatar: "D", winRate: 75.1, monthlyReturn: 9.1, followers: 1540, trades: 2567, profit: 25400, rank: 5 },
];

const feed = [
  { id: 1, user: "QuantMaster", avatar: "Q", action: "Fechou posição", asset: "WINFUT", profit: 1250, time: "há 15 min", likes: 42, comments: 8 },
  { id: 2, user: "AlphaTrader", avatar: "A", action: "Abriu posição", asset: "BTC/USD", profit: null, time: "há 32 min", likes: 28, comments: 5 },
  { id: 3, user: "CryptoKing", avatar: "C", action: "Fechou posição", asset: "ETH/USD", profit: 890, time: "há 1h", likes: 35, comments: 12 },
  { id: 4, user: "FXMaster", avatar: "F", action: "Fechou posição", asset: "EUR/USD", profit: -320, time: "há 2h", likes: 15, comments: 3 },
  { id: 5, user: "DayPro", avatar: "D", action: "Fechou posição", asset: "PETR4", profit: 670, time: "há 3h", likes: 22, comments: 6 },
];

export default function SocialTrading() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Social Trading</h1>
          <p className="text-muted-foreground">Siga traders, copie estratégias e construa sua rede</p>
        </div>

        <Tabs defaultValue="feed">
          <TabsList className="bg-secondary border border-border">
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="copytrade">Copy Trade</TabsTrigger>
          </TabsList>

          {/* Feed */}
          <TabsContent value="feed" className="mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {feed.map((post) => (
                  <Card key={post.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {post.avatar}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{post.user}</span>
                            <span className="text-xs text-muted-foreground">{post.time}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {post.action} em <span className="text-foreground font-medium">{post.asset}</span>
                            {post.profit !== null && (
                              <span className={`ml-2 font-bold ${post.profit > 0 ? "text-profit" : "text-loss"}`}>
                                {post.profit > 0 ? "+" : ""}R$ {post.profit.toFixed(2)}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <Heart className="w-3.5 h-3.5" /> {post.likes}
                            </button>
                            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <MessageCircle className="w-3.5 h-3.5" /> {post.comments}
                            </button>
                            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                              <Copy className="w-3.5 h-3.5" /> Copiar
                            </button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Sidebar - Top Traders */}
              <Card className="bg-card border-border h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-warning" /> Top Traders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {topTraders.slice(0, 5).map((trader) => (
                      <div key={trader.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold w-5 ${trader.rank <= 3 ? "text-warning" : "text-muted-foreground"}`}>#{trader.rank}</span>
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                            {trader.avatar}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{trader.name}</p>
                            <p className="text-xs text-muted-foreground">{trader.followers} seguidores</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-profit">+{trader.monthlyReturn}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Ranking */}
          <TabsContent value="ranking" className="mt-6">
            <div className="space-y-3">
              {topTraders.map((trader) => (
                <Card key={trader.id} className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          trader.rank === 1 ? "bg-warning/20 text-warning" :
                          trader.rank === 2 ? "bg-muted text-muted-foreground" :
                          trader.rank === 3 ? "bg-chart-4/20 text-chart-4" :
                          "bg-secondary text-muted-foreground"
                        }`}>
                          {trader.rank}
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                          {trader.avatar}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{trader.name}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{trader.followers} seguidores</span>
                            <span>{trader.trades} trades</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Win Rate</p>
                          <p className="text-sm font-bold text-foreground">{trader.winRate}%</p>
                        </div>
                        <div className="text-center hidden sm:block">
                          <p className="text-xs text-muted-foreground">Mensal</p>
                          <p className="text-sm font-bold text-profit">+{trader.monthlyReturn}%</p>
                        </div>
                        <div className="text-center hidden md:block">
                          <p className="text-xs text-muted-foreground">Lucro Total</p>
                          <p className="text-sm font-bold text-foreground">R$ {trader.profit.toLocaleString()}</p>
                        </div>
                        <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
                          <UserPlus className="w-3 h-3 mr-1" /> Seguir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Copy Trade */}
          <TabsContent value="copytrade" className="mt-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {topTraders.slice(0, 3).map((trader) => (
                <Card key={trader.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300">
                  <CardContent className="p-5 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl mx-auto mb-3">
                      {trader.avatar}
                    </div>
                    <p className="font-semibold text-foreground text-lg">{trader.name}</p>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <Star className="w-3 h-3 text-warning fill-warning" />
                      <span className="text-sm text-muted-foreground">{trader.followers} seguidores</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">WR</p>
                        <p className="text-sm font-bold text-foreground">{trader.winRate}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Mensal</p>
                        <p className="text-sm font-bold text-profit">+{trader.monthlyReturn}%</p>
                      </div>
                      <div className="p-2 rounded-md bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Trades</p>
                        <p className="text-sm font-bold text-foreground">{trader.trades}</p>
                      </div>
                    </div>

                    <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Copy className="w-4 h-4 mr-2" /> Copiar Trader
                    </Button>
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
