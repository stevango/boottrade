# Boot Trade AI - TODO

## Infraestrutura e Design
- [x] Tema visual dark premium (paleta escura, neon cyan, verde profit, vermelho loss)
- [x] Schema do banco de dados (users, robots, trades, backtest, marketplace, social)
- [x] Layout principal com sidebar de navegação colapsável

## Autenticação
- [x] Login social (Google, OAuth Manus)
- [x] Proteção de rotas por perfil de usuário (admin/user)
- [x] Página de perfil do usuário (integrado ao sidebar/avatar)

## Dashboard Principal
- [x] Métricas em tempo real (patrimônio, resultado diário/mensal, ROI)
- [x] Cards de drawdown, assertividade, profit factor
- [x] Robôs ativos e operações abertas
- [x] Gráficos de performance (Recharts)
- [x] IA Score e nível de risco

## Módulo de Robôs
- [x] Cards de robôs organizados por mercado (Dólar, Ações, Day Trade, Cripto, Apostas)
- [x] Ativação/pausa de robôs
- [x] Configuração de parâmetros de cada robô
- [x] Visualização de performance individual
- [x] Página de detalhes do robô

## Backtest Engine
- [x] Interface de configuração de backtest
- [x] Gráficos de resultado de simulação
- [x] Métricas de risco do backtest
- [x] Relatório detalhado exportável (Markdown com métricas completas)

## Paper Trade (Simulador)
- [x] Ambiente de operações simuladas
- [x] Capital virtual configurável
- [x] Histórico de operações simuladas
- [x] Ranking de performance em paper trade

## Gestão de Risco
- [x] Configuração de stop loss e take profit
- [x] Limite de perda diária
- [x] Drawdown máximo configurável
- [x] Alertas inteligentes
- [x] Dashboard de risco com indicadores visuais

## Marketplace de Robôs
- [x] Listagem de robôs disponíveis
- [x] Busca e filtros por mercado e performance
- [x] Página de detalhes da estratégia
- [x] Sistema de assinatura/compra de robôs
- [x] Avaliações e reviews

## Social Trading
- [x] Feed de operações de traders
- [x] Ranking de performance
- [x] Sistema de copy trade
- [x] Perfil público de especialistas
- [x] Seguidores e reputação

## Painel Administrativo
- [x] Gestão de usuários
- [x] Gestão de planos de assinatura
- [x] Métricas da plataforma
- [x] Controle de robôs publicados no marketplace

## Calendário e Notícias
- [x] Calendário econômico integrado ao dashboard
- [x] Feed de notícias financeiras
- [x] Alertas de eventos econômicos importantes

## Robôs com Cérebro Evolutivo
- [x] Schema e backend para cérebro evolutivo (tabelas, queries, mutations)
- [x] Página RobotBrain com indicador de maturidade e assertividade
- [x] Toggle de modo manual/semi-auto/auto com threshold de assertividade
- [x] Registro de decisões e histórico do cérebro
- [x] Painel de inteligência com métricas de aprendizado
- [x] Lógica real de cálculo de assertividade baseada em outcomes
- [x] Motor de aprendizado que atualiza learningData com padrões reais

## P&L Detalhado por Operação
- [x] Schema e API para daily_pnl e trades
- [x] Detalhamento por operação individual (decisões do cérebro)
- [x] Agregações semanal/mensal de P&L
- [x] Gráficos de evolução de resultado por período (página P&L dedicada)

## Consultor Financeiro IA
- [x] Interface de chat com 4 modos (consultor, auditor, mercado, operação)
- [x] Integração com LLM para respostas inteligentes
- [x] Prompts especializados por contexto
- [x] Sugestões de perguntas pré-definidas
- [x] Integrar dados reais da carteira do usuário nas respostas da IA
- [x] Conectar histórico de trades ao modo auditor

## Carteira Multi-Classe de Ativos
- [x] CRUD completo de ativos por classe (ações, renda fixa, fundos, cripto, CDB, tesouro, FII, internacional)
- [x] Visão consolidada do patrimônio com gráfico de alocação
- [x] Cálculo de P&L por ativo
- [x] Filtros por perfil de risco e horizonte de investimento

## Inteligência de Mercado
- [x] Modo "Analista de Mercado" no Consultor IA
- [x] Modo "Assistente de Trading" no Consultor IA
- [x] Integração com feeds de dados de mercado em tempo real (tab Mercado ao Vivo)
- [x] Alertas de movimentações relevantes (tab Alertas com configuração e histórico)

## Metas de Patrimônio
- [x] Definição de meta de resultado/patrimônio
- [x] Acompanhamento de progresso vs meta
- [x] Projeções baseadas em performance atual
- [x] Sugestões de ajuste para atingir metas

## Alocação Inteligente (Auditor de Investimentos)
- [x] Input de valor disponível para investimento
- [x] IA analisa objetivos, metas, perfil de risco e patrimônio atual
- [x] Recomendação personalizada de alocação (curto/médio/longo, conservador/arrojado)
- [x] Direção de como usar recursos vs objetivos e meta de potencializar
- [x] Visualização clara da sugestão de distribuição

## Integração com Corretoras
- [x] Módulo de conexão com corretoras (Clear, XP, Rico, BTG, Binance, etc.)
- [x] Interface para adicionar/gerenciar conexões
- [x] Importação de posições e saldos (estrutura pronta)
- [x] Status de conexão e sincronização
- [x] Suporte a múltiplas corretoras simultâneas
