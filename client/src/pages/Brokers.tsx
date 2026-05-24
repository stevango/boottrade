import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Link2, Plus, CheckCircle, AlertCircle, RefreshCw, Trash2, Shield, Loader2, Bitcoin, Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

type BrokerType = "crypto" | "traditional";
type BrokerDef = {
  id: string; name: string; logo: string; type: BrokerType; liveSync?: boolean;
  description: string; markets: string[];
};

const brokersList: BrokerDef[] = [
  // Crypto exchanges — real read-only API integration
  { id: "binance", name: "Binance", logo: "🟡", type: "crypto", liveSync: true, description: "Maior exchange de cripto do mundo. Sincroniza saldos via API read-only.", markets: ["Cripto", "Futuros", "Staking"] },
  { id: "mercadobitcoin", name: "Mercado Bitcoin", logo: "🟠", type: "crypto", liveSync: false, description: "Maior exchange brasileira de cripto.", markets: ["Cripto", "Tokens"] },
  // Traditional brokers — integration via Open Finance (coming soon)
  { id: "clear", name: "Clear Corretora", logo: "🟢", type: "traditional", description: "Corretagem zero para ações e opções", markets: ["Ações", "Opções", "FIIs", "Futuros"] },
  { id: "xp", name: "XP Investimentos", logo: "🟡", type: "traditional", description: "Maior plataforma de investimentos do Brasil", markets: ["Ações", "Renda Fixa", "Fundos"] },
  { id: "rico", name: "Rico (Grupo XP)", logo: "🟠", type: "traditional", description: "Investimentos simplificados", markets: ["Ações", "Renda Fixa", "Tesouro"] },
  { id: "btg", name: "BTG Pactual", logo: "🔵", type: "traditional", description: "Banco de investimentos premium", markets: ["Ações", "Renda Fixa", "Câmbio"] },
  { id: "nuinvest", name: "NuInvest (Nubank)", logo: "🟣", type: "traditional", description: "Investimentos integrados ao Nubank", markets: ["Ações", "FIIs", "Renda Fixa"] },
  { id: "inter", name: "Inter Invest", logo: "🟠", type: "traditional", description: "Investimentos do Banco Inter", markets: ["Ações", "Renda Fixa", "Fundos"] },
  { id: "modal", name: "Modal Mais", logo: "🔵", type: "traditional", description: "Corretora digital completa", markets: ["Ações", "Opções", "Futuros"] },
  { id: "avenue", name: "Avenue", logo: "🇺🇸", type: "traditional", description: "Investimentos no exterior (EUA)", markets: ["Ações US", "ETFs US", "REITs"] },
  { id: "toro", name: "Toro Investimentos", logo: "🟢", type: "traditional", description: "Corretora com análises e recomendações", markets: ["Ações", "FIIs", "Renda Fixa"] },
];

type SyncData = { balances?: { asset: string; free: string; locked: string }[]; note?: string; syncedAt?: number };

function parseSync(v: unknown): SyncData | null {
  if (!v) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v) as SyncData; } catch { return null; }
  }
  return v as SyncData;
}

export default function Brokers() {
  const { data: connections } = trpc.brokers.list.useQuery();
  const utils = trpc.useUtils();

  const addMutation = trpc.brokers.connect.useMutation({
    onSuccess: () => { toast.success("Exchange conectada com sucesso!"); utils.brokers.list.invalidate(); setDialogOpen(false); resetForm(); },
    onError: () => toast.error("Erro ao conectar. Verifique suas credenciais."),
  });
  const removeMutation = trpc.brokers.disconnect.useMutation({
    onSuccess: () => { toast.success("Conexão removida."); utils.brokers.list.invalidate(); },
  });
  const syncMutation = trpc.brokers.sync.useMutation({
    onSuccess: (r) => {
      const count = r && "count" in r ? r.count : 0;
      toast.success(count ? `Sincronizado: ${count} ativo(s).` : "Sincronização concluída.");
      utils.brokers.list.invalidate();
    },
    onError: () => toast.error("Falha na sincronização. Verifique as credenciais/permissões."),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerDef | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountId, setAccountId] = useState("");

  const resetForm = () => { setApiKey(""); setApiSecret(""); setAccountId(""); setSelectedBroker(null); };

  const openConnect = (broker: BrokerDef) => {
    if (broker.type !== "crypto") {
      toast.info("Integração via Open Finance em breve para corretoras tradicionais.");
      return;
    }
    setSelectedBroker(broker);
    setDialogOpen(true);
  };

  const handleConnect = () => {
    if (!selectedBroker) return;
    if (!apiKey.trim()) return toast.error("Informe a API Key.");
    addMutation.mutate({
      broker: selectedBroker.id,
      credentials: JSON.stringify({ apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), accountId: accountId.trim() }),
    });
  };

  const connected = connections ?? [];
  const isConnected = (id: string) => connected.some((c: any) => c.broker === id);
  const cryptoBrokers = brokersList.filter(b => b.type === "crypto" && !isConnected(b.id));
  const traditionalBrokers = brokersList.filter(b => b.type === "traditional" && !isConnected(b.id));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Link2 className="w-7 h-7 text-primary" />
            Integrações & Corretoras
          </h1>
          <p className="text-muted-foreground">Conecte exchanges de cripto para sincronizar seus saldos automaticamente</p>
        </div>

        {/* Connected */}
        {connected.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Conectadas</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {connected.map((conn: any) => {
                const broker = brokersList.find(b => b.id === conn.broker);
                const sync = parseSync(conn.syncData);
                return (
                  <Card key={conn.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">
                            {broker?.logo || "📊"}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{broker?.name || conn.broker}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {conn.status === "connected" ? (
                                <><CheckCircle className="w-3 h-3 text-profit" /><span className="text-xs text-profit">Conectado</span></>
                              ) : conn.status === "error" ? (
                                <><AlertCircle className="w-3 h-3 text-loss" /><span className="text-xs text-loss">Erro</span></>
                              ) : (
                                <><RefreshCw className="w-3 h-3 text-warning animate-spin" /><span className="text-xs text-warning">Sincronizando</span></>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Synced balances */}
                      {sync?.balances && sync.balances.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {sync.balances.slice(0, 4).map((b) => (
                            <div key={b.asset} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{b.asset}</span>
                              <span className="text-foreground font-medium">{parseFloat(b.free).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</span>
                            </div>
                          ))}
                          {sync.balances.length > 4 && (
                            <p className="text-[10px] text-muted-foreground">+{sync.balances.length - 4} outros ativos</p>
                          )}
                        </div>
                      )}
                      {sync?.note && <p className="text-xs text-muted-foreground mb-3">{sync.note}</p>}

                      {conn.lastSync && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Última sync: {new Date(conn.lastSync).toLocaleString("pt-BR")}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-xs"
                          onClick={() => syncMutation.mutate({ id: conn.id })}
                          disabled={syncMutation.isPending}>
                          {syncMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Sincronizar
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-loss border-loss/30 hover:bg-loss/10"
                          onClick={() => removeMutation.mutate({ id: conn.id })}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Crypto exchanges */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-primary" /> Exchanges de Cripto
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Conexão real via API com permissão de leitura. Use chaves <strong>read-only</strong>.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cryptoBrokers.map((broker) => (
              <Card key={broker.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{broker.logo}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{broker.name}</p>
                        {broker.liveSync && <Badge variant="secondary" className="text-[10px] bg-profit/10 text-profit">Sync ao vivo</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{broker.description}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => openConnect(broker)}>
                    <Link2 className="w-3 h-3 mr-1" /> Conectar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Traditional brokers */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" /> Corretoras tradicionais
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Corretoras de bolsa não oferecem API pública de chave/segredo. A importação de posições virá via <strong>Open Finance</strong> (somente leitura) — em breve.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {traditionalBrokers.map((broker) => (
              <Card key={broker.id} className="bg-card border-border opacity-80">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{broker.logo}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{broker.name}</p>
                      <p className="text-xs text-muted-foreground">{broker.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {broker.markets.slice(0, 3).map(m => <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>)}
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" disabled>
                    <Clock className="w-3 h-3 mr-1" /> Em breve (Open Finance)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-card border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Segurança das Integrações</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Suas chaves de API são criptografadas com AES-256-GCM no servidor e nunca retornam ao navegador.
                  Use sempre chaves com permissão <strong>somente leitura</strong> — o app não envia ordens.
                  Você pode revogar o acesso a qualquer momento removendo a conexão.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connect dialog (crypto only) */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Conectar {selectedBroker?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-primary" />
                <p className="text-xs font-medium text-primary">Conexão Segura (read-only)</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Crie uma API Key com permissão apenas de leitura na sua exchange. As credenciais são criptografadas (AES-256-GCM) e nunca retornam ao navegador.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">API Key</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Sua API Key" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">API Secret</Label>
              <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="Seu API Secret" className="bg-secondary border-border" />
            </div>
            <Button onClick={handleConnect} disabled={addMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {addMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</> : <><Link2 className="w-4 h-4 mr-2" /> Conectar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
