import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Trophy, Copy, Clock, Loader2, Heart, MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

function ComingSoon({ icon: Icon, title, desc }: { icon: typeof Users; title: string; desc: string }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="py-16 flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center"><Icon className="w-6 h-6 text-primary" /></div>
        <p className="text-foreground font-medium">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{desc}</p>
        <Badge variant="outline" className="text-xs"><Clock className="w-3 h-3 mr-1" /> Em breve</Badge>
      </CardContent>
    </Card>
  );
}

export default function SocialTrading() {
  const { data: feed, isLoading } = trpc.social.feed.useQuery();
  const posts = feed ?? [];

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

          <TabsContent value="feed" className="mt-6">
            {isLoading ? (
              <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : posts.length === 0 ? (
              <ComingSoon icon={Users} title="Feed da comunidade" desc="As operações compartilhadas pelos traders aparecerão aqui. Conforme a comunidade cresce, você poderá curtir, comentar e copiar operações." />
            ) : (
              <div className="space-y-4 max-w-2xl">
                {posts.map((post: any) => (
                  <Card key={post.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <p className="text-sm text-foreground">{post.content}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {post.likes ?? 0}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {post.comments ?? 0}</span>
                        <span className="flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copiar</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranking" className="mt-6">
            <ComingSoon icon={Trophy} title="Ranking de traders" desc="O ranking de performance da comunidade aparecerá aqui quando houver traders publicando seus resultados." />
          </TabsContent>

          <TabsContent value="copytrade" className="mt-6">
            <ComingSoon icon={Copy} title="Copy Trade" desc="Replique automaticamente as operações dos melhores traders. Disponível quando a comunidade e o roteamento de ordens estiverem ativos." />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
