import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Link2,
  Plus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const brokersList = [
  { id: "clear", name: "Clear Corretora", logo: "🟢", description: "Corretagem zero para ações e opções", markets: ["Ações", "Opções", "FIIs", "Futuros"] },
  { id: "xp", name: "XP Investimentos", logo: "🟡", description: "Maior plataforma de investimentos do Brasil", markets: ["Ações", "Renda Fixa", "Fundos", "COE", "Previdência"] },
  { id: "rico", name: "Rico (Grupo XP)", logo: "🟠", description: "Investimentos simplificados", markets: ["Ações", "Renda Fixa", "Fundos", "Tesouro Direto"] },
  { id: "btg", name: "BTG Pactual", logo: "🔵", description: "Banco de investimentos premium", markets: ["Ações", "Renda Fixa", "Fundos", "Câmbio", "Estruturados"] },
  { id: "nuinvest", name: "NuInvest (Nubank)", logo: "🟣", description: "Investimentos integrados ao Nubank", markets: ["Ações", "FIIs", "Renda Fixa", "Cripto"] },
  { id: "binance", name: "Binance", logo: "🟡", description: "Maior exchange de criptomoedas do mundo", markets: ["Cripto", "Futuros Cripto", "Staking", "DeFi"] },
  { id: "mercadobitcoin", name: "Mercado Bitcoin", logo: "🟠", description: "Maior exchange brasileira de cripto", markets: ["Cripto", "Tokens", "NFTs"] },
  { id: "inter", name: "Inter Invest", logo: "🟠", description: "Investimentos do Banco Inter", markets: ["Ações", "Renda Fixa", "Fundos", "Cripto"] },
  { id: "modal", name: "Modal Mais", logo: "🔵", description: "Corretora digital completa", markets: ["Ações", "Opções", "Futuros", "Renda Fixa"] },
  { id: "avenue", name: "Avenue", logo: "🇺🇸", description: "Investimentos no exterior (EUA)", markets: ["Ações US", "ETFs US", "REITs", "Bonds"] },
  { id: "passfolio", name: "Sproutfi (ex-Passfolio)", logo: "🌱", description: "Investimentos globais", markets: ["Ações US", "Cripto", "ETFs"] },
  { id: "toro", name: "Toro Investimentos", logo: "🟢", description: "Corretora com análises e recomendações", markets: ["Ações", "FIIs", "Renda Fixa"] },
];

export default function Brokers() {
  const { data: connections, isLoading } = trpc.brokers.list.useQuery();
  const addMutation = trpc.brokers.connect.useMutation({
    onSuccess: () => {
      toast.success("Corretora conectada com sucesso!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao conectar. Verifique suas credenciais."),
  });
  const removeMutation = trpc.brokers.disconnect.useMutation({
    onSuccess: () => toast.success("Corretora desconectada."),
  });
  const syncMutation = trpc.brokers.sync.useMutation({
    onSuccess: () => toast.success("Sincronização iniciada!"),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string>("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accountId, setAccountId] = useState("");

  const handleConnect = () => {
    if (!selectedBroker) {
      toast.error("Selecione uma corretora");
      return;
    }
    addMutation.mutate({
      broker: selectedBroker,
      credentials: JSON.stringify({ apiKey, apiSecret, accountId }),
    });
  };

  const connectedBrokers = connections || [];
  const availableBrokers = brokersList.filter(b => !connectedBrokers.find((c: any) => c.broker === b.id));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <Link2 className="w-7 h-7 text-primary" />
              Integrações & Corretoras
            </h1>
            <p className="text-muted-foreground">Conecte suas contas para importar posições e operar automaticamente</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Conectar Corretora
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-foreground">Conectar Nova Corretora</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Selecione a Corretora</Label>
                  <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                    <SelectTrigger className="bg-secondary border-border">
                      <SelectValue placeholder="Escolha uma corretora..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBrokers.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          <span className="flex items-center gap-2">
                            <span>{b.logo}</span>
                            <span>{b.name}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedBroker && (
                  <>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-primary" />
                        <p className="text-xs font-medium text-primary">Conexão Segura</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Suas credenciais são criptografadas e armazenadas com segurança. Utilizamos apenas permissões de leitura quando disponíveis.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">API Key / Token</Label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Sua chave de API"
                        className="bg-secondary border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">API Secret (se aplicável)</Label>
                      <Input
                        type="password"
                        value={apiSecret}
                        onChange={(e) => setApiSecret(e.target.value)}
                        placeholder="Seu secret"
                        className="bg-secondary border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">ID da Conta (opcional)</Label>
                      <Input
                        value={accountId}
                        onChange={(e) => setAccountId(e.target.value)}
                        placeholder="Número da conta ou CPF"
                        className="bg-secondary border-border"
                      />
                    </div>
                  </>
                )}

                <Button
                  onClick={handleConnect}
                  disabled={!selectedBroker || addMutation.isPending}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {addMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</>
                  ) : (
                    <><Link2 className="w-4 h-4 mr-2" /> Conectar</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Connected Brokers */}
        {connectedBrokers.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Corretoras Conectadas</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {connectedBrokers.map((conn: any) => {
                const broker = brokersList.find(b => b.id === conn.broker);
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

                      {conn.lastSync && (
                        <p className="text-xs text-muted-foreground mb-3">
                          Última sync: {new Date(conn.lastSync).toLocaleString("pt-BR")}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => syncMutation.mutate({ id: conn.id })}
                          disabled={syncMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" /> Sincronizar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-loss border-loss/30 hover:bg-loss/10"
                          onClick={() => removeMutation.mutate({ id: conn.id })}
                        >
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

        {/* Available Brokers */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Corretoras Disponíveis</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableBrokers.map((broker) => (
              <Card key={broker.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">
                      {broker.logo}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{broker.name}</p>
                      <p className="text-xs text-muted-foreground">{broker.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {broker.markets.slice(0, 3).map(m => (
                      <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                    ))}
                    {broker.markets.length > 3 && (
                      <Badge variant="secondary" className="text-[10px]">+{broker.markets.length - 3}</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => {
                      setSelectedBroker(broker.id);
                      setDialogOpen(true);
                    }}
                  >
                    <Link2 className="w-3 h-3 mr-1" /> Conectar
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
                  Todas as credenciais são criptografadas com AES-256 e armazenadas de forma segura. 
                  Utilizamos apenas permissões de leitura quando disponíveis (read-only API keys). 
                  Nenhuma operação é executada sem sua autorização explícita. 
                  Você pode revogar o acesso a qualquer momento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
