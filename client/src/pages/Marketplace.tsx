import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Search, Star, Users, TrendingUp, Shield, ShoppingBag } from "lucide-react";

const listings = [
  { id: 1, name: "Athena Pro v3", creator: "QuantMaster", market: "Mini Índice", price: 149.90, rating: 4.8, reviews: 234, subscribers: 1250, winRate: 82.5, monthlyReturn: 8.2, riskLevel: "medium", description: "Robô especialista em mini índice com IA preditiva avançada e gestão de risco integrada." },
  { id: 2, name: "Crypto Sniper", creator: "BlockchainPro", market: "Criptomoedas", price: 199.90, rating: 4.6, reviews: 189, subscribers: 890, winRate: 75.3, monthlyReturn: 12.4, riskLevel: "high", description: "Scalping em criptomoedas com detecção de padrões e arbitragem multi-exchange." },
  { id: 3, name: "Forex Eagle", creator: "FXTrader", market: "Forex", price: 99.90, rating: 4.5, reviews: 156, subscribers: 670, winRate: 71.8, monthlyReturn: 5.8, riskLevel: "low", description: "Estratégia conservadora para Forex com foco em pares principais e gestão de risco rigorosa." },
  { id: 4, name: "DayTrade Master", creator: "TraderElite", market: "Day Trade", price: 249.90, rating: 4.9, reviews: 312, subscribers: 2100, winRate: 85.1, monthlyReturn: 9.7, riskLevel: "medium", description: "O robô mais popular do marketplace. Especialista em day trade com múltiplos indicadores." },
  { id: 5, name: "Dollar Hunter", creator: "MacroTrader", market: "Mini Dólar", price: 129.90, rating: 4.4, reviews: 98, subscribers: 450, winRate: 73.6, monthlyReturn: 6.3, riskLevel: "medium", description: "Operações automatizadas em mini dólar com análise de fluxo e order flow." },
  { id: 6, name: "Sports Oracle", creator: "BetAnalytics", market: "Apostas", price: 79.90, rating: 4.3, reviews: 67, subscribers: 320, winRate: 68.9, monthlyReturn: 4.5, riskLevel: "high", description: "IA para apostas esportivas com análise estatística avançada e odds em tempo real." },
];

const riskColors = {
  low: "text-profit",
  medium: "text-warning",
  high: "text-loss",
};

export default function Marketplace() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground">Descubra e assine robôs criados pela comunidade</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar robôs..." className="pl-9 bg-secondary border-border" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
              <SelectValue placeholder="Mercado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="indices">Mini Índice</SelectItem>
              <SelectItem value="dolar">Mini Dólar</SelectItem>
              <SelectItem value="cripto">Criptomoedas</SelectItem>
              <SelectItem value="forex">Forex</SelectItem>
              <SelectItem value="daytrade">Day Trade</SelectItem>
              <SelectItem value="apostas">Apostas</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="popular">
            <SelectTrigger className="w-full sm:w-[160px] bg-secondary border-border">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Mais Popular</SelectItem>
              <SelectItem value="rating">Melhor Avaliado</SelectItem>
              <SelectItem value="return">Maior Retorno</SelectItem>
              <SelectItem value="price-low">Menor Preço</SelectItem>
              <SelectItem value="price-high">Maior Preço</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Listings Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <Card key={listing.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300 group">
              <CardContent className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Bot className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{listing.name}</p>
                      <p className="text-xs text-muted-foreground">por {listing.creator}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{listing.description}</p>

                {/* Tags */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary" className="text-xs">{listing.market}</Badge>
                  <Badge variant="outline" className={`text-xs ${riskColors[listing.riskLevel as keyof typeof riskColors]}`}>
                    Risco {listing.riskLevel === "low" ? "Baixo" : listing.riskLevel === "medium" ? "Médio" : "Alto"}
                  </Badge>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-md bg-secondary/50">
                    <p className="text-xs text-muted-foreground">Win Rate</p>
                    <p className="text-sm font-bold text-foreground">{listing.winRate}%</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary/50">
                    <p className="text-xs text-muted-foreground">Mensal</p>
                    <p className="text-sm font-bold text-profit">+{listing.monthlyReturn}%</p>
                  </div>
                  <div className="text-center p-2 rounded-md bg-secondary/50">
                    <p className="text-xs text-muted-foreground">Rating</p>
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-3 h-3 text-warning fill-warning" />
                      <span className="text-sm font-bold text-foreground">{listing.rating}</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-lg font-bold text-foreground">R$ {listing.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">/mês</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{listing.subscribers.toLocaleString()}</span>
                  </div>
                </div>

                <Button className="w-full mt-3 bg-primary hover:bg-primary/90 text-primary-foreground">
                  <ShoppingBag className="w-4 h-4 mr-2" /> Assinar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
