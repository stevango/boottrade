import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircuitBoard, CheckCircle, XCircle, Database, Cpu, Radar, ShieldCheck, Lock } from "lucide-react";
import { AdvisorPanel } from "@/components/AdvisorPanel";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle className="w-4 h-4 text-profit" /> : <XCircle className="w-4 h-4 text-loss" />}
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className={`text-xs ${ok ? "text-profit" : "text-loss"}`}>{detail}</span>
    </div>
  );
}

export default function Auditor() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: diag } = trpc.admin.diagnostics.useQuery(undefined, { enabled: isAdmin });

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="py-20 flex flex-col items-center justify-center text-center gap-2">
          <Lock className="w-10 h-10 text-muted-foreground/50" />
          <p className="text-foreground font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">O Auditor Técnico é exclusivo para administradores.</p>
        </div>
      </AppLayout>
    );
  }

  const buildContext = () => {
    if (!diag) return "Diagnóstico indisponível.";
    return `Diagnóstico real do sistema Boot Trade (stack: React 19 + Vite, Express + tRPC 11, Drizzle ORM/MySQL, deploy no Railway):

Infraestrutura:
- Banco de dados conectado: ${diag.dbConnected ? "sim" : "NÃO"}
- Provedor de IA (LLM) configurado: ${diag.llmConfigured ? "sim" : "NÃO"}
- Feed de mercado configurado: ${diag.marketDataConfigured ? "sim" : "NÃO"}

Volumes:
- Usuários: ${diag.counts.users}
- Robôs: ${diag.counts.robots}
- Trades: ${diag.counts.trades}
- Conexões de corretora: ${diag.counts.brokers}
- Backtests: ${diag.counts.backtests}

Segurança:
- Credenciais de corretora criptografadas (AES-256-GCM): ${diag.security.brokerCredentialsEncrypted ? "sim" : "não"}
- Erros internos mascarados ao cliente: ${diag.security.internalErrorsMasked ? "sim" : "não"}
- Endpoints de IA com rate-limit: ${diag.security.aiRateLimited ? "sim" : "não"}

Funcionalidades que ainda dependem de integração externa: feed de mercado global (ouro/ativos US), Open Finance (posições de corretoras tradicionais), execução real de ordens.

Com base nisso, aponte falhas, vulnerabilidades, pontos críticos e um roadmap priorizado: o que melhorar, o que criar, o que editar e o que remover.`;
  };

  const items = diag ? [
    { ok: diag.dbConnected, label: "Banco de dados", detail: diag.dbConnected ? "conectado" : "offline", icon: Database },
    { ok: diag.llmConfigured, label: "Consultor IA (LLM)", detail: diag.llmConfigured ? "ativo" : "configurar OPENAI_API_KEY", icon: Cpu },
    { ok: diag.marketDataConfigured, label: "Feed de mercado", detail: diag.marketDataConfigured ? "ativo" : "configurar BRAPI_TOKEN", icon: Radar },
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <CircuitBoard className="w-7 h-7 text-primary" /> Auditor Técnico
          </h1>
          <p className="text-muted-foreground">Diagnóstico real do sistema + orientação da IA para evoluir o Boot Trade</p>
        </div>

        {/* Integrations */}
        <div className="grid sm:grid-cols-3 gap-4">
          {items.map((i) => (
            <Card key={i.label} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <i.icon className="w-5 h-5 text-primary" />
                  {i.ok ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-[10px]">OK</Badge> : <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">Pendente</Badge>}
                </div>
                <p className="text-sm font-medium text-foreground">{i.label}</p>
                <p className="text-xs text-muted-foreground">{i.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Counts + security */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">Volumes</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {diag && Object.entries({ Usuários: diag.counts.users, Robôs: diag.counts.robots, Trades: diag.counts.trades, Corretoras: diag.counts.brokers, Backtests: diag.counts.backtests }).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-lg bg-secondary/30">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="text-lg font-bold text-foreground">{v}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Segurança</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {diag && (
                <>
                  <StatusRow ok={diag.security.brokerCredentialsEncrypted} label="Credenciais de corretora criptografadas (AES-256-GCM)" detail={diag.security.brokerCredentialsEncrypted ? "sim" : "não"} />
                  <StatusRow ok={diag.security.internalErrorsMasked} label="Erros internos mascarados ao cliente" detail={diag.security.internalErrorsMasked ? "sim" : "não"} />
                  <StatusRow ok={diag.security.aiRateLimited} label="Endpoints de IA com rate-limit" detail={diag.security.aiRateLimited ? "sim" : "não"} />
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI tech auditor */}
        <AdvisorPanel
          topic="tecnologia"
          title="Auditor Técnico IA"
          description="A IA analisa o diagnóstico real acima e propõe um roadmap priorizado: falhas, vulnerabilidades, o que criar, editar e remover."
          getContext={buildContext}
          buttonLabel="Auditar sistema"
        />
      </div>
    </AppLayout>
  );
}
