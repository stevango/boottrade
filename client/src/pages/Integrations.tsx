import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plug2, Link2, CheckCircle, AlertCircle, RefreshCw, Trash2, Shield, Loader2,
  Brain, Radar, Bitcoin, Trophy, Landmark, Clock, Save, X as XIcon, Zap, Info,
  Sparkles, Bot,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const ROBOT_MAP = {
  openai: ["Consultor IA", "Consultor de Risco", "Consultor de Alocação", "Auditor Técnico"],
  brapi: ["Análise de Tendência", "Scanner de Oportunidades", "Sinais do Cérebro (todos)"],
  binance: ["Kraken AI", "Nexus AI"],
  betfair: ["Oracle AI"],
  open_finance: ["Athena AI", "Titan AI", "Quantum AI", "Pulse AI", "Odin AI"],
  odds: ["Oracle AI", "Scanner de Esportes (Oportunidades)"],
  api_football: ["Análise de Partidas (Sinais)", "Oracle AI (contexto estatístico)"],
};

type SecretKey = "ODDS_API_KEY" | "ODDS_IO_API_KEY" | "API_FOOTBALL_KEY" | "OPENAI_API_KEY" | "BRAPI_TOKEN";

type FieldName = "apiKey" | "apiSecret" | "appKey" | "username" | "password" | "cert" | "key";
type Field = { name: FieldName; optional?: boolean; multiline?: boolean };
type ConnectableId = "binance" | "betfair";
type Connectable = { id: ConnectableId; name: string; logo: string; desc: string; usedBy: string[]; fields: Field[]; note?: string; docsUrl?: string; docsLabel?: string };

const CONNECTABLES: Connectable[] = [
  { id: "binance", name: "Binance", logo: "🟡",
    desc: "Exchange de cripto — saldo read-only via API. Crie a API Key em Account → API Management e marque apenas Enable Reading.",
    usedBy: ROBOT_MAP.binance, fields: [{ name: "apiKey" }, { name: "apiSecret" }],
    docsUrl: "https://developers.binance.com/docs/binance-spot-api-docs/CHANGELOG", docsLabel: "Doc oficial Binance Spot API" },
  { id: "betfair", name: "Betfair Brasil (Exchange)", logo: "🎯", desc: "Exchange de apostas — usa o endpoint regulamentado .bet.br (saldo read-only).", usedBy: ROBOT_MAP.betfair,
    fields: [
      { name: "appKey" }, { name: "username" }, { name: "password" },
      { name: "cert", optional: true, multiline: true }, { name: "key", optional: true, multiline: true },
    ],
    note: "Em BR, a Betfair frequentemente exige login com certificado cliente. Se você criou o certificado em Settings → My Security → My API Certificates, cole o conteúdo PEM do .crt e do .key abaixo.",
    docsUrl: "https://docs.developer.betfair.com/", docsLabel: "Doc Betfair Exchange API" },
];

type Traditional = { id: string; name: string; logo: string; desc: string; docsUrl?: string; usedBy: string[]; status: string };
const TRADITIONAL: Traditional[] = [
  { id: "clear", name: "Clear Corretora", logo: "🟢",
    desc: "API existe (devs.clear.com.br) mas é institucional/parceiro — não self-service. Para automação retail, a Clear usa MetaTrader 5 e Profit (Nelogica). A leitura de posições virá via Open Finance no futuro.",
    docsUrl: "https://devs.clear.com.br/index.html",
    usedBy: ROBOT_MAP.open_finance, status: "Requer parceria" },
  { id: "br_others", name: "XP, Rico, BTG, Inter, Modal, NuInvest…", logo: "🏦",
    desc: "Não oferecem API pública self-service para o trader. Importação de posições virá via Open Finance (somente leitura).",
    usedBy: ROBOT_MAP.open_finance, status: "Em breve (Open Finance)" },
];

const AUTOMATION: Traditional[] = [
  { id: "smarttbot", name: "SmarttBot", logo: "🚀",
    desc: "Plataforma brasileira de automação de estratégias. Não expõe API pública self-service para consumo externo — a SmarttBot É a plataforma de execução (estratégias rodam no painel dela, conectadas a uma corretora). Integração realista: enviar sinais do nosso cérebro para um webhook configurado na SmarttBot (em breve).",
    docsUrl: "https://smarttbot.com/wp-content/uploads/2022/05/Informacoes-API-SmarttBot-1.pdf",
    usedBy: ["Oracle AI (sinal → webhook)", "Demais robôs (futuro)"], status: "Sem API self-service" },
  { id: "mt5", name: "MetaTrader 5 / Profit (Nelogica)", logo: "📈",
    desc: "Terminais de execução automatizada usados por corretoras BR (Clear, XP, etc.). Não há REST API pública — automação roda dentro do próprio terminal (Expert Advisors / RoboTrader).",
    usedBy: ["Execução manual dos sinais"], status: "Sem API pública" },
];

type SyncData = { balances?: { asset: string; free: string; locked: string }[]; funds?: { availableToBetBalance: number; exposure: number }; note?: string };
const parseSync = (v: unknown): SyncData | null => {
  if (!v) return null;
  if (typeof v === "string") { try { return JSON.parse(v) as SyncData; } catch { return null; } }
  return v as SyncData;
};

function RobotChips({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((r) => (
        <span key={r} className="px-2 py-0.5 rounded-full text-[10px] bg-secondary text-muted-foreground border border-border">{r}</span>
      ))}
    </div>
  );
}

export default function Integrations() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: connections } = trpc.brokers.list.useQuery();
  const utils = trpc.useUtils();

  const addMutation = trpc.brokers.connect.useMutation({
    onSuccess: () => { toast.success("Integração conectada!"); utils.brokers.list.invalidate(); setDialogOpen(false); reset(); },
    onError: () => toast.error("Erro ao conectar. Verifique as credenciais."),
  });
  const removeMutation = trpc.brokers.disconnect.useMutation({
    onSuccess: () => { toast.success("Integração removida."); utils.brokers.list.invalidate(); },
  });
  const syncMutation = trpc.brokers.sync.useMutation({
    onSuccess: () => { toast.success("Sincronização concluída."); utils.brokers.list.invalidate(); },
    onError: () => toast.error("Falha ao sincronizar. Verifique as credenciais/permissões."),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Connectable | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const reset = () => { setForm({}); setSelected(null); };

  const openConnect = (item: Connectable) => { setSelected(item); setForm({}); setDialogOpen(true); };

  const submit = () => {
    if (!selected) return;
    for (const f of selected.fields) {
      if (!f.optional && !form[f.name]?.trim()) return toast.error(`Informe ${labelFor(f.name)}.`);
    }
    const payload: Record<string, string> = {};
    for (const f of selected.fields) {
      const v = form[f.name]?.trim();
      if (v) payload[f.name] = v;
    }
    addMutation.mutate({ broker: selected.id, credentials: JSON.stringify(payload) });
  };

  const connected = connections ?? [];
  const isConnected = (id: string) => connected.some((c: any) => c.broker === id);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Plug2 className="w-7 h-7 text-primary" /> Integrações
          </h1>
          <p className="text-muted-foreground">Veja o que está conectado, configure tokens e teste cada provedor</p>
          {!isAdmin && <BootstrapAdminBanner email={user?.email ?? null} />}
        </div>

        {/* Conectadas */}
        {connected.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-3">Conectadas</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {connected.map((conn: any) => {
                const def = CONNECTABLES.find((c) => c.id === conn.broker);
                const sync = parseSync(conn.syncData);
                return (
                  <Card key={conn.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{def?.logo ?? "🔌"}</div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{def?.name ?? conn.broker}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              {conn.status === "connected" ? (<><CheckCircle className="w-3 h-3 text-profit" /><span className="text-xs text-profit">Conectado</span></>)
                                : conn.status === "error" ? (<><AlertCircle className="w-3 h-3 text-loss" /><span className="text-xs text-loss">Erro</span></>)
                                : (<><RefreshCw className="w-3 h-3 text-warning animate-spin" /><span className="text-xs text-warning">Sincronizando</span></>)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {sync?.balances && sync.balances.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {sync.balances.slice(0, 4).map((b) => (
                            <div key={b.asset} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{b.asset}</span>
                              <span className="text-foreground font-medium">{parseFloat(b.free).toLocaleString("pt-BR", { maximumFractionDigits: 8 })}</span>
                            </div>
                          ))}
                          {sync.balances.length > 4 && <p className="text-[10px] text-muted-foreground">+{sync.balances.length - 4} outros ativos</p>}
                        </div>
                      )}
                      {sync?.funds && (
                        <div className="mb-3 space-y-1">
                          <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Disponível</span><span className="text-foreground font-medium">{sync.funds.availableToBetBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                          <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Exposição</span><span className="text-foreground font-medium">{sync.funds.exposure.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
                        </div>
                      )}
                      {def && <RobotChips items={def.usedBy} />}
                      {conn.lastSync && <p className="text-xs text-muted-foreground mt-3">Última sync: {new Date(conn.lastSync).toLocaleString("pt-BR")}</p>}

                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => syncMutation.mutate({ id: conn.id })} disabled={syncMutation.isPending}>
                          {syncMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Sincronizar
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-loss border-loss/30 hover:bg-loss/10" onClick={() => removeMutation.mutate({ id: conn.id })}>
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

        {/* Provedores de IA */}
        <Section title="Provedores de IA" icon={Brain}>
          <ServerKeyCard
            settingKey="OPENAI_API_KEY"
            name="OpenAI (Consultor IA)" logo="🧠" envVar="OPENAI_API_KEY"
            desc="Ativa todos os consultores de IA do app (Risco, Alocação, Auditor, Operação)."
            usedBy={ROBOT_MAP.openai}
            docsUrl="https://platform.openai.com/docs/api-reference"
            configuredQuery={trpc.ai.configured.useQuery()}
            testMutation={trpc.ai.test.useMutation}
            isAdmin={isAdmin}
          />
        </Section>

        {/* Feeds de mercado */}
        <Section title="Feeds de Mercado" icon={Radar}>
          <ServerKeyCard
            settingKey="BRAPI_TOKEN"
            name="brapi.dev (B3)" logo="📊" envVar="BRAPI_TOKEN"
            desc="Cotações e histórico de ativos da B3 — alimenta análise de tendência, scanner e os sinais do cérebro dos robôs."
            usedBy={ROBOT_MAP.brapi}
            docsUrl="https://brapi.dev/dashboard"
            configuredQuery={trpc.market.configured.useQuery()}
            testMutation={trpc.market.test.useMutation}
            isAdmin={isAdmin}
          />
          <ServerKeyCard
            settingKey="ODDS_API_KEY"
            name="The Odds API (esportes)" logo="🎲" envVar="ODDS_API_KEY"
            desc="Odds em tempo real de 200+ casas. Plano free ~500 req/mês."
            usedBy={ROBOT_MAP.odds}
            docsUrl="https://the-odds-api.com/liveapi/guides/v4/"
            configuredQuery={trpc.odds.configured.useQuery()}
            testQuery={trpc.odds.sports.useQuery}
            isAdmin={isAdmin}
          />
          <ServerKeyCard
            settingKey="ODDS_IO_API_KEY"
            name="Odds-API.io (esportes)" logo="🎰" envVar="ODDS_IO_API_KEY"
            desc="Alternativa: 265+ casas, 34 esportes, free de 100 req/hora (sem cartão)."
            usedBy={ROBOT_MAP.odds}
            docsUrl="https://docs.odds-api.io"
            configuredQuery={trpc.oddsIo.configured.useQuery()}
            testQuery={trpc.oddsIo.sports.useQuery}
            isAdmin={isAdmin}
          />
          <ServerKeyCard
            settingKey="API_FOOTBALL_KEY"
            name="API-Football (estatísticas)" logo="📈" envVar="API_FOOTBALL_KEY"
            desc="H2H, forma recente, predições e artilheiros. Alimenta a Análise de Partida em cada sinal do Oracle. Free: 100 req/dia (sem cartão)."
            usedBy={ROBOT_MAP.api_football}
            docsUrl="https://www.api-football.com/documentation-v3"
            configuredQuery={trpc.matchAnalysis.configured.useQuery()}
            testMutation={trpc.matchAnalysis.test.useMutation}
            isAdmin={isAdmin}
          />
        </Section>

        {/* Cripto */}
        <Section title="Exchanges de Cripto" icon={Bitcoin}>
          {CONNECTABLES.filter((c) => c.id === "binance" && !isConnected(c.id)).map((c) => (
            <ConnectableCard key={c.id} item={c} onConnect={() => openConnect(c)} />
          ))}
          {isConnected("binance") && <NoteAlready name="Binance" />}
        </Section>

        {/* Apostas / esportes */}
        <Section title="Casas e Exchanges de Apostas" icon={Trophy}>
          {CONNECTABLES.filter((c) => c.id === "betfair" && !isConnected(c.id)).map((c) => (
            <ConnectableCard key={c.id} item={c} onConnect={() => openConnect(c)} />
          ))}
          {isConnected("betfair") && <NoteAlready name="Betfair" />}
        </Section>

        {/* Tradicionais */}
        <Section title="Corretoras Tradicionais" icon={Landmark}>
          {TRADITIONAL.map((t) => <TraditionalCard key={t.id} item={t} />)}
        </Section>

        {/* Plataformas de automação (sem API self-service) */}
        <Section title="Plataformas de Automação" icon={Zap}>
          {AUTOMATION.map((t) => <TraditionalCard key={t.id} item={t} />)}
        </Section>

        <Section title="Roteamento de Ordens (OMS)" icon={Bot}>
          <OmsRoutingCard isAdmin={isAdmin} />
        </Section>

        <Section title="Comportamento dos Robôs" icon={Bot}>
          <OracleAutoAdviseCard isAdmin={isAdmin} />
          <BetfairAutoBetCard isAdmin={isAdmin} />
          <WebhookOutCard isAdmin={isAdmin} />
        </Section>

        <Card className="bg-card border-primary/20">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Shield className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Segurança e escopo</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Credenciais (chaves, senhas, certificados) são criptografadas com AES-256-GCM no servidor e <strong>nunca retornam ao navegador</strong>.
                Os robôs do app são <strong>cérebros de aprendizado</strong> — eles registram sinais e aprendem com os resultados,
                mas <strong>nenhuma operação é executada automaticamente</strong>. A execução é manual na plataforma; sincronizamos saldo/exposição read-only.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connect dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) reset(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">Conectar {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-2 mb-1"><Shield className="w-4 h-4 text-primary" /><p className="text-xs font-medium text-primary">Conexão Segura (read-only)</p></div>
              <p className="text-xs text-muted-foreground">
                {selected?.id === "betfair"
                  ? "Usa os endpoints regulamentados .bet.br. Apenas saldo e exposição são lidos."
                  : "Crie uma API Key na exchange com permissão apenas de leitura."}
                {" "}Credenciais são criptografadas (AES-256-GCM) e nunca retornam ao navegador.
              </p>
            </div>
            {selected?.note && (<p className="text-[11px] text-muted-foreground leading-relaxed bg-secondary/40 rounded p-2">{selected.note}</p>)}
            {selected?.fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {labelFor(f.name)}{f.optional && <span className="text-muted-foreground/70"> (opcional)</span>}
                </Label>
                {f.multiline ? (
                  <Textarea value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={placeholderFor(f.name)} rows={5} className="bg-secondary border-border font-mono text-[11px]" />
                ) : (
                  <Input type={f.name === "username" ? "text" : "password"} autoComplete="off" value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })} placeholder={placeholderFor(f.name)} className="bg-secondary border-border" />
                )}
              </div>
            ))}
            <Button onClick={submit} disabled={addMutation.isPending} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {addMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Conectando...</> : <><Link2 className="w-4 h-4 mr-2" /> Conectar</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function BootstrapAdminBanner({ email }: { email: string | null }) {
  const utils = trpc.useUtils();
  const { refresh } = useAuth();
  const claim = trpc.auth.claimAdminBootstrap.useMutation({
    onSuccess: async () => {
      toast.success("Você agora é admin. Recarregando...");
      await utils.auth.me.invalidate();
      await refresh();
      // Hard reload so all admin-gated UIs revalidate cleanly.
      setTimeout(() => window.location.reload(), 400);
    },
    onError: (e) => toast.error(e.message || "Não foi possível promover."),
  });
  return (
    <div className="mt-3 p-3 rounded-lg bg-warning/5 border border-warning/20 flex flex-col sm:flex-row sm:items-center gap-3">
      <Info className="w-4 h-4 text-warning shrink-0" />
      <div className="text-xs text-muted-foreground leading-relaxed flex-1">
        <strong className="text-foreground">Você não é admin.</strong> Para salvar tokens dos provedores de servidor (OpenAI, brapi, Odds), você precisa ser admin.
        {" "}Se ainda <strong>não existe nenhum admin</strong> no sistema, clique no botão ao lado para se tornar o primeiro (uma vez só — depois disso a opção fecha).
        {" "}Alternativa: <code className="text-primary">UPDATE users SET role='admin' WHERE email='{email ?? "seu@email.com"}';</code>
      </div>
      <Button size="sm" onClick={() => claim.mutate()} disabled={claim.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
        {claim.isPending ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Promovendo...</> : <><Shield className="w-3 h-3 mr-1" /> Tornar-me admin</>}
      </Button>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Brain; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2"><Icon className="w-5 h-5 text-primary" /> {title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">{children}</div>
    </div>
  );
}

// Unified card for server-side keys (admin sets via UI; envvar override still works).
function ServerKeyCard(props: {
  settingKey: SecretKey;
  name: string; logo: string; envVar: string; desc: string; usedBy: string[];
  docsUrl?: string;
  configuredQuery: { data?: { configured?: boolean } };
  testMutation?: any; // trpc useMutation factory (ai.test, market.test)
  testQuery?: any;    // trpc useQuery factory used for testing (odds.sports, oddsIo.sports)
  isAdmin: boolean;
}) {
  const utils = trpc.useUtils();
  const { data: meta } = trpc.admin.getSetting.useQuery({ key: props.settingKey }, { enabled: props.isAdmin });
  const [token, setToken] = useState("");
  const [verify, setVerify] = useState<{ ok: boolean; message: string; at: Date } | null>(null);

  const saveMut = trpc.admin.setSetting.useMutation({
    onSuccess: () => { toast.success("Token salvo."); setToken(""); utils.admin.getSetting.invalidate(); props.configuredQuery && (utils as any)[providerNs(props.settingKey)]?.configured?.invalidate?.(); },
    onError: () => toast.error("Falha ao salvar."),
  });
  const clearMut = trpc.admin.clearSetting.useMutation({
    onSuccess: () => { toast.success("Token removido."); setVerify(null); utils.admin.getSetting.invalidate(); (utils as any)[providerNs(props.settingKey)]?.configured?.invalidate?.(); },
  });

  // Either a dedicated test mutation OR re-runs the existing list query
  const testMut = props.testMutation?.({
    onSuccess: (r: any) => { setVerify({ ok: r.ok, message: r.message, at: new Date() }); (utils as any)[providerNs(props.settingKey)]?.configured?.invalidate?.(); },
    onError: (e: any) => setVerify({ ok: false, message: e?.message || "Falha", at: new Date() }),
  });
  const testQueryHook = props.testQuery ? props.testQuery(undefined, { enabled: false }) : null;
  const runTest = async () => {
    if (testMut) { testMut.mutate(undefined as any); return; }
    if (testQueryHook) {
      const r = await testQueryHook.refetch();
      const d: any = r.data;
      if (!d) setVerify({ ok: false, message: "Sem resposta", at: new Date() });
      else if (d.configured === false) setVerify({ ok: false, message: "Token não configurado", at: new Date() });
      else if (d.error) setVerify({ ok: false, message: d.error, at: new Date() });
      else if (Array.isArray(d.sports)) setVerify({ ok: d.sports.length > 0, message: d.sports.length > 0 ? `Conectado: ${d.sports.length} esportes` : "Resposta vazia", at: new Date() });
      else setVerify({ ok: true, message: "Conectado", at: new Date() });
    }
  };

  const envConfigured = !!props.configuredQuery.data?.configured;
  const dbConfigured = !!meta?.configured;
  const isConnected = envConfigured || dbConfigured;

  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{props.logo}</div>
            <div>
              <CardTitle className="text-base text-foreground flex items-center gap-2">
                {props.name}
                {isConnected
                  ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-[10px]">Conectado</Badge>
                  : <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">Inativa</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{props.desc}</p>
              {props.docsUrl && <a href={props.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">Documentação da API</a>}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">API Key ({props.envVar})</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={dbConfigured ? "Salvo no banco — digite outro para substituir" : envConfigured ? "Definido por variável de ambiente — digite um para sobrescrever" : "Cole sua chave aqui"}
              className="bg-secondary border-border flex-1 min-w-[200px]"
              disabled={!props.isAdmin}
            />
            <Button
              size="sm"
              onClick={() => token.trim() && saveMut.mutate({ key: props.settingKey, value: token })}
              disabled={!props.isAdmin || !token.trim() || saveMut.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saveMut.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />} Salvar
            </Button>
            {dbConfigured && (
              <Button size="sm" variant="outline" className="text-loss border-loss/30 hover:bg-loss/10"
                onClick={() => clearMut.mutate({ key: props.settingKey })} disabled={!props.isAdmin || clearMut.isPending}>
                <XIcon className="w-3 h-3 mr-1" /> Desconectar
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="outline" onClick={runTest} disabled={!isConnected || (testMut?.isPending ?? false) || (testQueryHook?.isFetching ?? false)}>
            {(testMut?.isPending || testQueryHook?.isFetching) ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />} Testar conexão
          </Button>
          {verify && (
            <span className={`text-xs ${verify.ok ? "text-profit" : "text-loss"}`}>
              {verify.ok ? "✓" : "⚠"} {verify.message} · {verify.at.toLocaleTimeString("pt-BR")}
            </span>
          )}
          {dbConfigured && meta?.updatedAt && !verify && (
            <span className="text-[11px] text-muted-foreground">Salvo em {new Date(meta.updatedAt).toLocaleString("pt-BR")} (AES-256-GCM)</span>
          )}
        </div>
        {!isConnected && (
          <p className="text-[11px] text-muted-foreground">
            Alternativa via variável de servidor: defina <code className="text-primary">{props.envVar}</code> no Railway → Variables.
          </p>
        )}
        <RobotChips items={props.usedBy} />
      </CardContent>
    </Card>
  );
}

// Maps a setting key to the corresponding tRPC namespace used to invalidate
// `configured` queries after save/clear/test.
function providerNs(key: SecretKey): "ai" | "market" | "odds" | "oddsIo" | "matchAnalysis" {
  if (key === "OPENAI_API_KEY") return "ai";
  if (key === "BRAPI_TOKEN") return "market";
  if (key === "ODDS_API_KEY") return "odds";
  if (key === "ODDS_IO_API_KEY") return "oddsIo";
  return "matchAnalysis";
}

function ConnectableCard({ item, onConnect }: { item: Connectable; onConnect: () => void }) {
  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{item.logo}</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
            {item.docsUrl && (<a href={item.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">{item.docsLabel ?? "Documentação"}</a>)}
          </div>
        </div>
        <RobotChips items={item.usedBy} />
        <Button size="sm" variant="outline" className="w-full text-xs mt-3" onClick={onConnect}>
          <Link2 className="w-3 h-3 mr-1" /> Conectar
        </Button>
      </CardContent>
    </Card>
  );
}

function OracleAutoAdviseCard({ isAdmin }: { isAdmin: boolean }) {
  const cfg = trpc.oracleConfig.get.useQuery();
  const utils = trpc.useUtils();
  const setMut = trpc.oracleConfig.set.useMutation({
    onSuccess: () => { toast.success("Configuração salva."); utils.oracleConfig.get.invalidate(); utils.signals.exposure.invalidate(); },
    onError: () => toast.error("Falha ao salvar."),
  });
  const enabled = cfg.data?.autoAdviseEnabled ?? true;
  const topN = cfg.data?.autoAdviseTopN ?? 5;
  const dailyMaxBets = cfg.data?.dailyMaxBets ?? 5;
  const dailyMaxStakePct = cfg.data?.dailyMaxStakePct ?? 10;
  // Quota napkin math: each advised signal burns ~9 API-Football calls + 1
  // LLM call. With Oracle ticking every hour, a daily quota of 100 calls on
  // the free plan supports roughly floor(100/9) ≈ 11 advised signals total
  // per 24h. We surface the math so the admin can size topN sanely.
  const dailyAfCalls = enabled ? topN * 9 * 24 : 0;

  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" /> Auto-orientação do Oracle AI
          {enabled
            ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-[10px]">Ativo</Badge>
            : <Badge variant="outline" className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 text-[10px]">Desligado</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          A cada varredura do Oracle (de hora em hora), o consultor IA gera automaticamente uma recomendação SIM/NÃO/CAUTELOSO
          pros sinais com maior edge — você abre o app e já encontra a leitura pronta.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Label className="text-sm text-foreground">Ativar auto-orientação</Label>
            <p className="text-[11px] text-muted-foreground">Quando desligado, o consultor só roda quando você clicar em "Pedir orientação".</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => setMut.mutate({ autoAdviseEnabled: v })}
            disabled={!isAdmin || setMut.isPending}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label className="text-sm text-foreground">Sinais auto-orientados por varredura</Label>
            <Badge variant="outline" className="text-xs">{topN} sinais</Badge>
          </div>
          <input
            type="range" min="0" max="10" step="1" value={topN}
            onChange={(e) => setMut.mutate({ autoAdviseTopN: parseInt(e.target.value, 10) })}
            disabled={!isAdmin || setMut.isPending || !enabled}
            className="w-full accent-primary disabled:opacity-50"
          />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>0 (manual)</span><span>5 (padrão)</span><span>10 (máx)</span>
          </div>
        </div>

        <div className="p-3 rounded bg-warning/5 border border-warning/20">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Consumo de quota estimado:</strong> com {topN} sinais auto-orientados a cada hora,
            o servidor faz ~{dailyAfCalls} chamadas/dia na API-Football e ~{enabled ? topN * 24 : 0} no LLM (OpenAI).
            {dailyAfCalls > 100 && (
              <>
                {" "}<strong className="text-warning">Atenção:</strong> o plano free da API-Football tem limite de 100 req/dia. Reduza pra {Math.floor(100 / (9 * 24))} sinais
                ou faça upgrade pra evitar erro de quota.
              </>
            )}
            {!enabled && " Apenas chamadas manuais (botão 'Pedir orientação') consomem quota."}
          </p>
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <Label className="text-sm text-foreground">Limites diários (anti-tilt)</Label>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Protege contra "perseguir prejuízos". Quando o limite é atingido, o painel em /signals avisa pra você parar por hoje.
          </p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground">Máximo de apostas SIM por dia</Label>
              <Badge variant="outline" className="text-xs">{dailyMaxBets} apostas</Badge>
            </div>
            <input
              type="range" min="0" max="20" step="1" value={dailyMaxBets}
              onChange={(e) => setMut.mutate({ dailyMaxBets: parseInt(e.target.value, 10) })}
              disabled={!isAdmin || setMut.isPending}
              className="w-full accent-primary disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0 (sem limite manual)</span><span>5 (recomendado)</span><span>20</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground">Máximo de stake por dia (% da banca)</Label>
              <Badge variant="outline" className="text-xs">{dailyMaxStakePct}%</Badge>
            </div>
            <input
              type="range" min="0" max="30" step="0.5" value={dailyMaxStakePct}
              onChange={(e) => setMut.mutate({ dailyMaxStakePct: parseFloat(e.target.value) })}
              disabled={!isAdmin || setMut.isPending}
              className="w-full accent-primary disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span><span>10% (recomendado)</span><span>30%</span>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground italic">Apenas administradores podem alterar essa configuração.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BetfairAutoBetCard({ isAdmin }: { isAdmin: boolean }) {
  const cfg = trpc.betfair.autoConfig.useQuery();
  const utils = trpc.useUtils();
  const setMut = trpc.betfair.setAutoConfig.useMutation({
    onSuccess: () => { toast.success("Configuração salva."); utils.betfair.autoConfig.invalidate(); },
    onError: () => toast.error("Falha ao salvar."),
  });
  const enabled = cfg.data?.enabled ?? false;
  const maxStake = cfg.data?.maxStakeBrl ?? 10;

  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          ⚡ Auto-execução Betfair
          {enabled
            ? <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">DINHEIRO REAL ATIVO</Badge>
            : <Badge variant="outline" className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 text-[10px]">Desligado</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quando ligado: cada sinal com decisão <strong>SIM</strong> dispara uma aposta real na Betfair Brasil automaticamente.
          Requer: integração Betfair conectada + saldo + mercado MATCH_ODDS correspondente disponível.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded bg-loss/5 border border-loss/30">
          <p className="text-[11px] text-foreground font-medium">⚠️ Aviso de risco</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Auto-bet usa <strong>dinheiro real</strong>. Comece com <strong>modo cobaia</strong> (R$ 1-10) por 1-2 semanas pra validar.
            Sistema pode falhar (rede, API, mercado fechado) — apostas que falham ficam registradas com erro.
            Sempre cheque seu painel da Betfair separadamente.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Label className="text-sm text-foreground">Ativar auto-execução Betfair</Label>
            <p className="text-[11px] text-muted-foreground">Sem isso, você ainda pode usar o botão "Apostar agora" manualmente em cada sinal.</p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => setMut.mutate({ enabled: v })}
            disabled={!isAdmin || setMut.isPending}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-xs text-foreground">Stake máximo por aposta automática (R$)</Label>
            <Badge variant="outline" className="text-xs">R$ {maxStake.toFixed(2)}</Badge>
          </div>
          <input
            type="range" min="1" max="500" step="1" value={maxStake}
            onChange={(e) => setMut.mutate({ maxStakeBrl: parseFloat(e.target.value) })}
            disabled={!isAdmin || setMut.isPending}
            className="w-full accent-warning disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>R$ 1 (cobaia)</span><span>R$ 50</span><span>R$ 500 (máx)</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Quando a IA recomendar stake maior que esse limite, o sistema reduz pra esse teto antes de apostar. Proteção contra bugs.
          </p>
        </div>

        {!isAdmin && (
          <p className="text-[11px] text-muted-foreground italic">Apenas administradores podem alterar essa configuração.</p>
        )}
      </CardContent>
    </Card>
  );
}

function OmsRoutingCard({ isAdmin }: { isAdmin: boolean }) {
  const cfg = trpc.oms.config.useQuery();
  const utils = trpc.useUtils();
  const setMut = trpc.oms.setConfig.useMutation({
    onSuccess: () => { toast.success("Roteamento atualizado."); utils.oms.config.invalidate(); },
    onError: () => toast.error("Falha ao salvar."),
  });
  const testMut = trpc.oms.testBroker.useMutation();
  const route = cfg.data?.routingMode ?? "off";
  const killSwitch = cfg.data?.killSwitch ?? false;
  const dailyMax = cfg.data?.dailyMaxStakeBrl ?? 500;
  const perOrderMax = cfg.data?.maxPerOrderBrl ?? 100;

  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          🎯 OMS — Order Management System
          {killSwitch
            ? <Badge variant="outline" className="bg-loss/10 text-loss border-loss/30 text-[10px]">KILL SWITCH ATIVO</Badge>
            : route === "off"
              ? <Badge variant="outline" className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 text-[10px]">Desligado</Badge>
              : route === "paper"
                ? <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">Paper (simulado)</Badge>
                : <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">{route.toUpperCase()} — DINHEIRO REAL</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Onde as ordens dos robôs vão. <strong>Paper</strong> = simula contra preços brapi sem dinheiro real (use pra testar).
          <strong> Clear</strong> = envia ordens reais via API Clear (precisa credenciais aprovadas).
          <strong> Desligado</strong> = robôs geram sinais mas ninguém executa.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm text-foreground mb-2 block">Modo de roteamento</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {([
              ["off", "🔴 Desligado", "Só sinais"],
              ["paper", "🧪 Paper", "Simulado"],
              ["clear", "💼 Clear", "B3 real"],
              ["ibkr", "🌎 IBKR", "Internacional"],
              ["mercado_bitcoin", "₿ MB", "Crypto BRL"],
            ] as const).map(([mode, label, hint]) => (
              <button key={mode}
                onClick={() => setMut.mutate({ routingMode: mode })}
                disabled={!isAdmin || setMut.isPending}
                className={`p-3 rounded-lg border text-xs transition-colors ${route === mode ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary/30 text-muted-foreground hover:text-foreground"} disabled:opacity-50`}>
                {label}<br /><span className="text-[10px]">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(["paper", "clear", "ibkr", "mercado_bitcoin"] as const).map((b) => (
            <Button key={b} size="sm" variant="outline" onClick={() => testMut.mutate({ broker: b }, {
              onSuccess: (r) => r.ok ? toast.success(`${b}: ${r.message}`) : toast.error(`${b}: ${r.message}`),
            })}>Testar {b}</Button>
          ))}
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-foreground">Limites de risco</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground">Stake máximo por ordem (R$)</Label>
              <Badge variant="outline" className="text-xs">R$ {perOrderMax.toFixed(0)}</Badge>
            </div>
            <input type="range" min="10" max="5000" step="10" value={perOrderMax}
              onChange={(e) => setMut.mutate({ maxPerOrderBrl: parseFloat(e.target.value) })}
              disabled={!isAdmin || setMut.isPending}
              className="w-full accent-primary disabled:opacity-50" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-foreground">Stake máximo por dia (R$)</Label>
              <Badge variant="outline" className="text-xs">R$ {dailyMax.toFixed(0)}</Badge>
            </div>
            <input type="range" min="50" max="50000" step="50" value={dailyMax}
              onChange={(e) => setMut.mutate({ dailyMaxStakeBrl: parseFloat(e.target.value) })}
              disabled={!isAdmin || setMut.isPending}
              className="w-full accent-primary disabled:opacity-50" />
          </div>
        </div>

        <div className="border-t border-border pt-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Label className="text-sm text-loss">⚠ Kill Switch</Label>
            <p className="text-[11px] text-muted-foreground">Quando ligado: bloqueia TODAS as ordens imediatamente, independente do modo. Use em emergência.</p>
          </div>
          <Switch checked={killSwitch} onCheckedChange={(v) => setMut.mutate({ killSwitch: v })} disabled={!isAdmin || setMut.isPending} />
        </div>

        <div className="p-3 rounded bg-secondary/40 border border-border text-[11px] text-muted-foreground">
          <p className="text-foreground font-medium mb-1">Status atual</p>
          <p>Roteamento: <code className="text-primary">{route}</code> · Kill switch: <code>{killSwitch ? "ON" : "off"}</code> · Por ordem: R$ {perOrderMax} · Por dia: R$ {dailyMax}</p>
          <p className="mt-1">Conectores instalados: <code>paper</code>, <code>clear</code>, <code>ibkr</code>, <code>mercado_bitcoin</code>. Próximos: <code>cedro</code>, <code>btg</code>, <code>oanda</code> (forex).</p>
        </div>
      </CardContent>
    </Card>
  );
}

function WebhookOutCard({ isAdmin }: { isAdmin: boolean }) {
  const cfg = trpc.webhooks.get.useQuery();
  const utils = trpc.useUtils();
  const setMut = trpc.webhooks.set.useMutation({
    onSuccess: () => { toast.success("Webhook salvo."); utils.webhooks.get.invalidate(); },
    onError: () => toast.error("Falha ao salvar."),
  });
  const testMut = trpc.webhooks.test.useMutation();
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const enabled = cfg.data?.enabled ?? false;
  const onlySim = cfg.data?.onlySim ?? true;
  const currentUrl = cfg.data?.url ?? "";

  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-foreground flex items-center gap-2">
          📡 Webhook de Saída (SmarttBot / TradingView / n8n)
          {enabled
            ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-[10px]">Ativo</Badge>
            : <Badge variant="outline" className="bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20 text-[10px]">Desligado</Badge>}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cada sinal SIM dispara um POST JSON pra URL configurada — perfeito pra plugar SmarttBot, TradingView strategies,
          n8n/Zapier ou um EA do MetaTrader. É o caminho realista pra automação de B3 (corretoras brasileiras não têm API).
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL do webhook</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={url || currentUrl}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hook.smarttbot.com/.../seu-id"
              className="bg-secondary border-border flex-1 min-w-[280px]"
              disabled={!isAdmin}
            />
            <Button size="sm"
              onClick={() => { if (url) setMut.mutate({ url }); }}
              disabled={!isAdmin || !url || setMut.isPending}>
              <Save className="w-3 h-3 mr-1" /> Salvar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Segredo (opcional) — vai no header X-Webhook-Secret</Label>
          <div className="flex gap-2 flex-wrap">
            <Input
              type="password" autoComplete="off"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={cfg.data?.hasSecret ? "•••••••• (já configurado)" : "Opcional"}
              className="bg-secondary border-border flex-1 min-w-[280px]"
              disabled={!isAdmin}
            />
            <Button size="sm" variant="outline"
              onClick={() => { if (secret) setMut.mutate({ secret }); setSecret(""); }}
              disabled={!isAdmin || !secret || setMut.isPending}>
              Salvar segredo
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <div>
            <Label className="text-sm text-foreground">Ativar webhook</Label>
            <p className="text-[11px] text-muted-foreground">Cada novo sinal SIM dispara um POST.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={(v) => setMut.mutate({ enabled: v })} disabled={!isAdmin || setMut.isPending} />
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Label className="text-sm text-foreground">Apenas SIM (recomendado)</Label>
            <p className="text-[11px] text-muted-foreground">Quando ligado, só dispara webhook quando IA decide SIM. Desligado, dispara em TODOS os sinais (NÃO/CAUTELOSO também).</p>
          </div>
          <Switch checked={onlySim} onCheckedChange={(v) => setMut.mutate({ onlySim: v })} disabled={!isAdmin || setMut.isPending} />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button size="sm" variant="outline"
            onClick={() => testMut.mutate(undefined as any, {
              onSuccess: (r) => r.ok ? toast.success(`Webhook OK · HTTP ${r.status}`) : toast.error(`Falhou: ${r.error}`),
              onError: () => toast.error("Falha ao testar."),
            })}
            disabled={!isAdmin || testMut.isPending || !enabled}>
            <Zap className="w-3 h-3 mr-1" /> Testar agora
          </Button>
          {testMut.data && (
            <span className={`text-[11px] ${testMut.data.ok ? "text-profit" : "text-loss"}`}>
              {testMut.data.ok ? `✓ ${testMut.data.status}` : `⚠ ${testMut.data.error}`}
            </span>
          )}
        </div>

        <div className="p-3 rounded bg-secondary/40 border border-border">
          <p className="text-[11px] text-foreground font-medium mb-1">Formato do payload:</p>
          <pre className="text-[10px] text-muted-foreground overflow-x-auto">{`{
  "robot": "athena-ai",
  "source": "athena",
  "asset": "PETR4",
  "side": "buy",
  "confidence": 78,
  "reasoning": "Golden Cross ativo...",
  "bestPrice": 38.45,
  "decision": "SIM",
  "generatedAt": "2026-06-11T20:00:00Z"
}`}</pre>
        </div>
      </CardContent>
    </Card>
  );
}

function TraditionalCard({ item }: { item: Traditional }) {
  return (
    <Card className="bg-card border-border opacity-90">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{item.logo}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]"><Clock className="w-3 h-3 mr-1" /> {item.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
            {item.docsUrl && (<a href={item.docsUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">Portal de developers da corretora</a>)}
          </div>
        </div>
        <RobotChips items={item.usedBy} />
      </CardContent>
    </Card>
  );
}

function NoteAlready({ name }: { name: string }) {
  return (
    <Card className="bg-card border-border sm:col-span-2 lg:col-span-3"><CardContent className="p-4 flex items-center gap-2 text-xs text-muted-foreground">
      <CheckCircle className="w-4 h-4 text-profit" /> {name} já está conectada — veja em "Conectadas" acima.
    </CardContent></Card>
  );
}

function labelFor(f: string): string {
  return ({ apiKey: "API Key", apiSecret: "API Secret", appKey: "App Key", username: "Usuário", password: "Senha", cert: "Certificado cliente (PEM)", key: "Chave privada do certificado (PEM)" } as Record<string, string>)[f] ?? f;
}
function placeholderFor(f: string): string {
  return ({
    apiKey: "Sua API Key", apiSecret: "Seu API Secret",
    appKey: "App Key da sua conta",
    username: "seu_usuario", password: "••••••••",
    cert: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  } as Record<string, string>)[f] ?? "";
}
