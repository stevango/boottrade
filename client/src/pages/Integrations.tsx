import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plug2, Link2, CheckCircle, AlertCircle, RefreshCw, Trash2, Shield, Loader2,
  Brain, Radar, Bitcoin, Trophy, Landmark, Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const ROBOT_MAP = {
  openai: ["Consultor IA", "Consultor de Risco", "Consultor de Alocação", "Auditor Técnico"],
  brapi: ["Análise de Tendência", "Scanner de Oportunidades", "Sinais do Cérebro (todos)"],
  binance: ["Kraken AI", "Nexus AI"],
  betfair: ["Oracle AI"],
  open_finance: ["Athena AI", "Titan AI", "Quantum AI", "Pulse AI", "Odin AI"],
};

type FieldName = "apiKey" | "apiSecret" | "appKey" | "username" | "password" | "cert" | "key";
type Field = { name: FieldName; optional?: boolean; multiline?: boolean };
type ConnectableId = "binance" | "betfair";
type Connectable = { id: ConnectableId; name: string; logo: string; desc: string; usedBy: string[]; fields: Field[]; note?: string };

const CONNECTABLES: Connectable[] = [
  { id: "binance", name: "Binance", logo: "🟡", desc: "Exchange de cripto — saldo read-only via API.", usedBy: ROBOT_MAP.binance, fields: [{ name: "apiKey" }, { name: "apiSecret" }] },
  { id: "betfair", name: "Betfair Brasil (Exchange)", logo: "🎯", desc: "Exchange de apostas — usa o endpoint regulamentado .bet.br (saldo read-only).", usedBy: ROBOT_MAP.betfair,
    fields: [
      { name: "appKey" }, { name: "username" }, { name: "password" },
      { name: "cert", optional: true, multiline: true }, { name: "key", optional: true, multiline: true },
    ],
    note: "Em BR, a Betfair frequentemente exige login com certificado cliente. Se você criou o certificado em Settings → My Security → My API Certificates, cole o conteúdo PEM do .crt e do .key abaixo. Se ainda não tem cert, deixe em branco e tentaremos login interativo primeiro." },
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
  const { data: connections } = trpc.brokers.list.useQuery();
  const { data: aiCfg } = trpc.ai.configured.useQuery();
  const { data: marketCfg } = trpc.market.configured.useQuery();
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

  const openConnect = (item: Connectable) => {
    setSelected(item); setForm({}); setDialogOpen(true);
  };

  const submit = () => {
    if (!selected) return;
    for (const f of selected.fields) {
      if (!f.optional && !form[f.name]?.trim()) return toast.error(`Informe ${labelFor(f.name)}.`);
    }
    // Drop empty optional fields so the server doesn't receive blanks.
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
          <p className="text-muted-foreground">Veja o que está conectado e quais robôs cada integração ativa</p>
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
          <ServerIntegration
            name="OpenAI (Consultor IA)" logo="🧠" envVar="OPENAI_API_KEY"
            configured={!!aiCfg?.configured}
            desc="Ativa todos os consultores de IA do app (Risco, Alocação, Auditor, Operação)."
            usedBy={ROBOT_MAP.openai}
          />
        </Section>

        {/* Feeds de mercado */}
        <Section title="Feeds de Mercado" icon={Radar}>
          <ServerIntegration
            name="brapi.dev (B3)" logo="📊" envVar="BRAPI_TOKEN"
            configured={!!marketCfg?.configured}
            desc="Cotações e histórico de ativos da B3 — alimenta análise de tendência, scanner e os sinais do cérebro dos robôs."
            usedBy={ROBOT_MAP.brapi}
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
          <Card className="bg-card border-border opacity-80">
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">🏦</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><p className="text-sm font-medium text-foreground">Clear, XP, Rico, BTG, Inter, Modal, NuInvest…</p><Badge variant="outline" className="text-[10px]"><Clock className="w-3 h-3 mr-1" /> Em breve</Badge></div>
                  <p className="text-xs text-muted-foreground">Importação de posições via Open Finance (somente leitura). Corretoras de bolsa não oferecem API pública self-service para o trader; a leitura virá pelo agregador.</p>
                  <RobotChips items={ROBOT_MAP.open_finance} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* Info */}
        <Card className="bg-card border-primary/20">
          <CardContent className="p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Shield className="w-5 h-5 text-primary" /></div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Segurança e escopo</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Credenciais de integração são criptografadas com AES-256-GCM no servidor e <strong>nunca retornam ao navegador</strong>.
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
                  ? "Usa os endpoints regulamentados .bet.br. Apenas saldo e exposição são lidos — nenhuma aposta é enviada pelo app."
                  : "Crie uma API Key na exchange com permissão apenas de leitura."}
                {" "}Credenciais são criptografadas (AES-256-GCM) e nunca retornam ao navegador.
              </p>
            </div>
            {selected?.note && (
              <p className="text-[11px] text-muted-foreground leading-relaxed bg-secondary/40 rounded p-2">{selected.note}</p>
            )}
            {selected?.fields.map((f) => (
              <div key={f.name} className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  {labelFor(f.name)}{f.optional && <span className="text-muted-foreground/70"> (opcional)</span>}
                </Label>
                {f.multiline ? (
                  <Textarea
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    placeholder={placeholderFor(f.name)}
                    rows={5}
                    className="bg-secondary border-border font-mono text-[11px]"
                  />
                ) : (
                  <Input
                    type={f.name === "username" ? "text" : "password"}
                    autoComplete="off"
                    value={form[f.name] ?? ""}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    placeholder={placeholderFor(f.name)}
                    className="bg-secondary border-border"
                  />
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

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Brain; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2"><Icon className="w-5 h-5 text-primary" /> {title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">{children}</div>
    </div>
  );
}

function ServerIntegration({ name, logo, envVar, configured, desc, usedBy }: { name: string; logo: string; envVar: string; configured: boolean; desc: string; usedBy: string[] }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">{logo}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{name}</p>
              {configured
                ? <Badge variant="outline" className="bg-profit/10 text-profit border-profit/20 text-[10px]">Ativo</Badge>
                : <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-[10px]">Configurar</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
        {!configured && (
          <p className="text-[11px] text-muted-foreground mt-2">
            Defina <code className="text-primary">{envVar}</code> nas variáveis do servidor (Railway → Variables).
          </p>
        )}
        <RobotChips items={usedBy} />
      </CardContent>
    </Card>
  );
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
