import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Star, Users, ShoppingBag, Clock, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

const num = (v: unknown) => parseFloat(String(v ?? "0"));

export default function Marketplace() {
  const { data: listings, isLoading } = trpc.marketplace.list.useQuery();
  const items = listings ?? [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Marketplace</h1>
          <p className="text-muted-foreground">Descubra e assine robôs publicados pela comunidade</p>
        </div>

        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><ShoppingBag className="w-6 h-6 text-primary" /></div>
              <p className="text-foreground font-medium">Marketplace da comunidade</p>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Aqui aparecerão os robôs publicados pelos traders. Conforme a comunidade cresce, você poderá descobrir, avaliar e assinar estratégias — e publicar as suas.
              </p>
              <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" /> Em breve</Badge>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((listing: any) => (
              <Card key={listing.id} className="bg-card border-border hover:border-primary/30 transition-all duration-300 group">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center"><Bot className="w-6 h-6 text-primary" /></div>
                    <div>
                      <p className="font-semibold text-foreground">{listing.title}</p>
                      <p className="text-xs text-muted-foreground">{listing.subscriptionType}</p>
                    </div>
                  </div>
                  {listing.description && <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{listing.description}</p>}
                  <div className="flex items-center justify-between text-xs mb-4">
                    <div className="flex items-center gap-1"><Star className="w-3 h-3 text-warning fill-warning" /><span className="text-foreground font-medium">{num(listing.rating).toFixed(1)}</span><span className="text-muted-foreground">({listing.totalReviews ?? 0})</span></div>
                    <div className="flex items-center gap-1 text-muted-foreground"><Users className="w-3 h-3" /><span>{listing.totalSubscribers ?? 0}</span></div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <p className="text-lg font-bold text-foreground">R$ {num(listing.price).toFixed(2)}</p>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><ShoppingBag className="w-4 h-4 mr-2" /> Assinar</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
