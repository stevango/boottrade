# Boot Trade AI

Plataforma de trading com robôs inteligentes, cérebro evolutivo, backtest, gestão de risco, alocação e consultores de IA. Stack: **React 19 + Vite**, **Express + tRPC 11**, **Drizzle ORM (MySQL)**.

> ⚠️ Investimentos envolvem risco. Os consultores de IA e os sinais de tendência são **apoio à decisão e análise descritiva — não previsão nem recomendação garantida**. Os planos de alocação e simulações são determinísticos/estatísticos, não promessas de retorno.

---

## Rodando localmente

```bash
pnpm install
# defina as variáveis de ambiente (ver tabela abaixo); no mínimo DATABASE_URL e JWT_SECRET
DATABASE_URL="mysql://user:pass@host:3306/db" pnpm db:push   # cria as tabelas
pnpm dev                                                     # http://localhost:3000
```

`pnpm check` (typecheck), `pnpm test` (vitest), `pnpm build` (produção).

## Deploy (Railway)

O repositório já inclui `railway.json`:
- **pré-deploy** roda `pnpm db:migrate` (aplica migrations dentro da rede do Railway — a `DATABASE_URL` privada resolve ali);
- **start** roda `pnpm start` em produção;
- Node fixado em **22** (`.nvmrc` + `engines`) — o app usa `import.meta.dirname`, que exige Node ≥ 20.11.

Conecte um serviço **MySQL** ao serviço da app e referencie a URL: `DATABASE_URL=${{MySQL.MYSQL_URL}}`. A cada deploy as migrations rodam sozinhas.

---

## Variáveis de ambiente

| Variável | Obrigatória | O que faz |
|---|---|---|
| `DATABASE_URL` | ✅ | Conexão MySQL (8.0+ / TiDB / PlanetScale). |
| `JWT_SECRET` | ✅ | Assina a sessão **e** deriva a chave AES das credenciais de corretora. Use um valor forte (`openssl rand -base64 48`). |
| `NODE_ENV` | ✅ (prod) | `production` serve o build estático e mascara erros internos. |
| `OPENAI_API_KEY` | opcional | Ativa os consultores de IA (Consultor, Risco, Alocação, Auditor). |
| `LLM_BASE_URL` / `LLM_MODEL` | opcional | Usar outro provedor compatível com OpenAI (padrão: `https://api.openai.com/v1`, `gpt-4o-mini`). |
| `BRAPI_TOKEN` | opcional | Ativa análise de tendência e o scanner de Oportunidades (dados B3 via brapi.dev). |

Sem as opcionais, os recursos correspondentes **degradam com mensagem clara** em vez de quebrar. Segredos do servidor vão nas variáveis do ambiente — **nunca** na UI.

### Virar administrador (acesso ao Auditor Técnico e Admin)

```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

---

## Recursos

| Área | Estado | Requer |
|---|---|---|
| Login/cadastro (e-mail + senha) | ✅ real | — |
| Dashboard + Primeiros passos | ✅ real | — |
| Robôs (catálogo + ativar/pausar) | ✅ real | — |
| Cérebro evolutivo (sinais → decisão → aprende) | ✅ real | sinais: `BRAPI_TOKEN` |
| Paper Trade (simulador persistido) | ✅ real | — |
| Backtest (Monte Carlo) | ✅ real | — |
| Alocação multi-objetivo/horizonte → metas | ✅ real | — |
| Gestão de risco + Consultor de Risco IA | ✅ real | IA: `OPENAI_API_KEY` |
| Oportunidades (watchlist + scanner) | ✅ real | `BRAPI_TOKEN` |
| Corretoras — cripto (Binance read-only) | ✅ real | chave da Binance do usuário |
| Corretoras tradicionais / Mercado / Notícias / Marketplace / Social | ⏳ honesto "em breve" | integração externa (Open Finance, feeds, comunidade) |
| Auditor Técnico (admin) | ✅ real | IA: `OPENAI_API_KEY` |

---

## Arquitetura

```
client/src/
  pages/          páginas (lazy-loaded por rota)
  components/     UI (shadcn) + AdvisorPanel, AppLayout
  _core/hooks     useAuth
server/
  routers.ts      procedures tRPC
  db.ts           queries Drizzle
  crypto.ts       AES-256-GCM (credenciais de corretora)
  password.ts     scrypt (senhas)
  llm.ts          wrapper de IA (Forge → OpenAI-compatível → degradação)
  allocation.ts   motor de alocação determinístico
  backtest.ts     Monte Carlo
  signals.ts      análise de tendência
  marketData.ts   feed brapi (plugável)
  binance.ts      saldo read-only
  _core/          infra (sessão, contexto, vite) — evitar editar
drizzle/          schema + migrations
```

## Segurança

- Senhas: scrypt + `timingSafeEqual`. Sessão: JWT HS256 (allowlist de algoritmo).
- Credenciais de corretora: AES-256-GCM em repouso; **nunca** retornam ao cliente.
- Todo acesso a dados é escopado por usuário; rotas admin via `adminProcedure`.
- Erros internos mascarados ao cliente; cabeçalhos HTTP de segurança (anti-clickjacking, nosniff, HSTS).
- Endpoints de IA com rate-limit.
