# Boot Trade — Guia de Setup do Zero ao Automatizado

Este guia leva você de zero a operação 100% automatizada, em ordem.
Cada etapa tem uma verificação clara — só passe pra próxima quando a anterior estiver OK.

---

## ETAPA 0 — Confirma que o app está no ar

**Ação:**
- Abre a URL do seu app (Railway): `https://SEU-APP.up.railway.app`
- Faz login com seu e-mail/senha
- Verifica que /dashboard abre

**Verificação:**
- Acessa `https://SEU-APP.up.railway.app/api/version`
- Deve mostrar o commit mais recente (ex: `3666983`)

Se /api/version mostra erro, o deploy travou — me chama.

---

## ETAPA 1 — Garante que você é admin

Algumas configurações (Integrações, OMS, brokers) precisam do role admin.

**Ação:**
- Vai em `/integrations`
- Se aparecer banner amarelo "Você não é admin" no topo:
  - Clica em **"Tornar-me admin"** (só funciona se ainda não existe nenhum admin)
- Se nada acontecer, o admin já existe — você precisa rodar SQL no Railway:
  ```sql
  UPDATE users SET role='admin' WHERE email='seu@email.com';
  ```

**Verificação:**
- Em `/integrations`, os campos de configuração ficam **editáveis** (não desabilitados)

---

## ETAPA 2 — Configura APIs essenciais

Você precisa de **pelo menos uma** de cada categoria abaixo.

### 2.1 — Dados de mercado (escolha 1)
- **brapi.dev** (B3, grátis) — necessário pra Athena AI
  - Cria conta em https://brapi.dev/dashboard
  - Copia o token
  - Em `/integrations` → "brapi.dev (B3)" → cola token → Salvar → Testar

### 2.2 — Dados de esportes (opcional, só se vai usar Oracle AI)
- **The Odds API** (500 req/mês grátis)
  - https://the-odds-api.com → cadastra → token
  - Em `/integrations` → cola
- **OU Odds-API.io** (100 req/hora grátis, sem cartão)
  - https://odds-api.io → cadastra → token
  - Em `/integrations` → cola

### 2.3 — Inteligência (escolha 1, opcional mas recomendado)
- **OpenAI** (pra consultor IA)
  - https://platform.openai.com → API key
  - Em `/integrations` → cola

### 2.4 — Estatística esportiva (opcional, só pra análise de partidas)
- **API-Football** (100 req/dia grátis, sem cartão)
  - https://api-football.com → cadastra → token
  - Em `/integrations` → cola

**Verificação:**
- Cada card que você configurou mostra badge verde **"Conectado"**
- Clicar em "Testar conexão" retorna mensagem positiva

---

## ETAPA 3 — Ativa os robôs

**Ação:**
- Vai em `/robots`
- Pra cada robô que quiser usar, clica **"Ativar"**:
  - **Oracle AI** — esportes (precisa Odds APIs + opcionalmente OpenAI + API-Football)
  - **Athena AI** — B3 (precisa brapi.dev)
  - **Kraken AI** — crypto BRL (não precisa nada — usa Mercado Bitcoin público)

**Verificação:**
- Card do robô mostra badge **"Ativo"** verde
- Após algumas horas (próximo tick do scheduler), começa a gerar sinais em `/signals`

---

## ETAPA 4 — Configura OMS em modo Paper (zero risco)

Agora você liga o motor de execução, mas em modo SIMULADO. Nenhum dinheiro real.

**Ação:**
- `/integrations` → seção **"🎯 OMS — Order Management System"**
- Clica no card **"🧪 Paper"** → vira modo paper
- Define limites de segurança:
  - **Stake máximo por ordem**: R$ 100 (default)
  - **Stake máximo por dia**: R$ 500 (default)
- Deixa **Kill Switch DESLIGADO**

**Verificação:**
- Status no rodapé do card: `Roteamento: paper`
- Badge no topo do card: **"Paper (simulado)"**

---

## ETAPA 5 — Testa o pipeline completo (Paper mode)

**Ação:**
1. Vai em `/signals`
2. Clica em **"Athena (B3)"** no topo → roda Athena agora
3. Aguarda toast: "Athena rodou: X sinais novos"
4. Procura nos sinais aparecendo um com badge **"orientado"** (consultor IA já rodou)
5. Abre esse sinal → "Analisar partida" não funciona pra ações, então olha o "Consultor IA" embutido
6. Na caixa **"🎯 OMS · Paper Trading"**, clica **"Executar via OMS"**
7. Aguarda toast: "Ordem enviada via Paper!"

**Verificação:**
- Vai em `/order-history` → vê a ordem com status **"Enviada"** ou **"Ganhou"**
- Vai em `/broker-portfolio` → aba Paper Trading → vê a posição aparecendo
- Saldo paper inicial era R$ 10.000; após compra de R$ 100, saldo cai pra R$ 9.900

Se chegou até aqui, **o pipeline inteiro está funcionando**. Repete com Kraken se quiser testar crypto.

---

## ETAPA 6 — Configurações de produção (Paper)

Antes de migrar pra dinheiro real, deixa o paper rodando por **1-2 semanas**.

### 6.1 — Limites diários
- `/integrations` → "Comportamento dos Robôs" → "Auto-orientação Oracle AI"
- **Apostas SIM/dia**: 3-5 (anti-tilt)
- **Stake %/dia**: 5-10% da banca

### 6.2 — Banca de referência
- Em qualquer sinal, abre o consultor IA → rodapé "R$ 10.000 · editar"
- Coloca o valor que VAI usar quando migrar pra real (ex: R$ 1.000 cobaia)

### 6.3 — Acompanhamento
- Abre o app **1-2x ao dia**
- Verifica `/order-history` → ROI e win rate evoluindo
- Verifica `/simulation` → "se tivesse seguido todos os SIMs do Oracle, quanto teria"
- Marca resultado dos sinais esportivos manualmente (Oracle não tem auto-resolução pra alguns mercados)

---

## ETAPA 7 — Migra pra dinheiro real (escolha um broker)

Só faça isso **DEPOIS** de 1-2 semanas com paper mostrando ROI positivo consistente.

### Opção A — Interactive Brokers (mais rápido pra começar)

**Pré-requisitos:**
- Conta IB com saldo USD (mínimo recomendado: USD 100 cobaia)

**Setup:**
1. Acessa https://www.interactivebrokers.com/sso/Login
2. Vai em **Settings → API Settings → Web API** (Client Portal)
3. Anota seu **accountId** (ex: U1234567)
4. Loga em https://clientportal.gw.interactivebrokers.com pra obter session token
5. Copia o cookie `api=...` do browser dev tools
6. Em `/integrations` → conecta IBKR com {accountId, sessionToken}
7. `/integrations → OMS` → switch pra **🌎 IBKR**

**Importante:** o session token expira diariamente. Você precisa renovar manualmente todo dia, OU usar IB Gateway local com auto-login (mais complexo, posso fazer depois).

### Opção B — Mercado Bitcoin (crypto BRL)

**Pré-requisitos:**
- Conta Mercado Bitcoin com saldo BRL

**Setup:**
1. Acessa https://www.mercadobitcoin.com.br
2. Vai em **Perfil → API**
3. Cria nova API key com permissões: `read`, `trade`
4. Copia **apiKey + apiSecret + accountId**
5. Em `/integrations` → conecta com {apiKey, apiSecret, accountId}
6. `/integrations → OMS` → switch pra **₿ Mercado Bitcoin**

### Opção C — Clear Smart Trader (B3 BR, aguarda aprovação)

**Pré-requisitos:**
- Conta Clear Corretora ativa
- Aprovação no programa developer

**Setup:**
1. Acessa https://devs.clear.com.br
2. Solicita acesso developer (variável tempo de aprovação)
3. Recebe **clientId + clientSecret**
4. Em `/integrations` → conecta Clear
5. `/integrations → OMS` → switch pra **💼 Clear**

### Opção D — Betfair (esportes, exchange)

Já está implementado e funciona se você tiver conta Betfair Brasil com saldo.

1. `/integrations` → "Casas e Exchanges de Apostas" → Betfair Brasil → Conectar com cert/login
2. `/integrations` → seção Betfair Auto-Bet → Ativar com stake máximo R$ 10 cobaia
3. Cada sinal Oracle SIM dispara aposta automática

---

## ETAPA 8 — Operação diária

Quando estiver tudo rodando, sua rotina vira:

### Manhã (5 min)
- Abre `/dashboard` → checa P&L do dia anterior
- Abre `/order-history` → revisa execuções da noite
- Se algo errado, **kill switch ON** em `/integrations → OMS`

### Ao longo do dia
- Robôs rodam sozinhos no scheduler:
  - Oracle: 1h
  - Athena: 4h
  - Kraken: 2h
- Ordens executam via OMS automaticamente
- `/broker-portfolio` atualiza a cada 30s

### Noite (3 min)
- `/order-history` → confere o dia
- `/simulation` → vê acurácia evoluindo
- Marca resultados pendentes manualmente se precisar

---

## ETAPA 9 — Emergência

Algo deu errado? Em ordem de severidade:

### Nível 1 — Pausar auto-orientação
- `/integrations` → "Comportamento dos Robôs" → desliga switch da Auto-orientação
- Sinais continuam sendo gerados, mas IA não roda automaticamente

### Nível 2 — Pausar auto-execução Betfair
- `/integrations` → seção Betfair → desliga switch "Ativar auto-execução"
- Não envia mais apostas reais sozinho

### Nível 3 — Switch routing pra OFF
- `/integrations → OMS` → modo **🔴 Desligado**
- Robôs continuam gerando sinais mas ninguém executa

### Nível 4 — KILL SWITCH GLOBAL
- `/integrations → OMS` → liga **⚠ Kill Switch**
- TODAS as ordens bloqueadas IMEDIATAMENTE, independente do modo

### Nível 5 — Cancela ordens pendentes na corretora
- Vai DIRETO no painel do broker (Bet365, IB, MB, etc)
- Cancela ordens que ainda não executaram
- Boot Trade não consegue cancelar ordens já enviadas que já foram aceitas

---

## Resumo de cada página

| Página | O que mostra |
|---|---|
| `/dashboard` | Resumo geral |
| `/robots` | Catálogo + ativação de robôs |
| `/signals` | Sugestões com filtros, consultor IA, botões de execução |
| `/recommendations` | Histórico de orientações IA |
| `/simulation` | Backtest "se tivesse seguido tudo" |
| `/broker-portfolio` | Saldo + posições por broker |
| `/order-history` | Todas as ordens com filtros |
| `/integrations` | API keys, OMS, brokers, limites, webhooks |
| `/goals` | Metas financeiras (Copa do Mundo preset) |
| `/risk` | Configurações de risco |
| `/portfolio` | Portfólio manual |

---

## Glossário rápido

- **Sinal/Sugestão** — recomendação gerada pelo robô (não é aposta real)
- **Decisão SIM/NÃO/CAUTELOSO** — output do consultor IA pra aquele sinal
- **Stake** — valor em R$ apostado/investido por ordem
- **OMS** — Order Management System: o motor que roteia ordens pro broker
- **Kill Switch** — botão de emergência que bloqueia tudo
- **Paper Trading** — simulação sem dinheiro real, contra preços de mercado
- **Routing** — qual broker recebe a ordem (paper/clear/ibkr/MB)
- **Idempotência** — sistema garante que mesmo sinal não vira 2 ordens
- **Webhook OUT** — POST automático pra plataformas externas (SmarttBot, TradingView)
