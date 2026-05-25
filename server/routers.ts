import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";
import { sdk } from "./_core/sdk";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./password";
import {
  getAllRobots, getRobotById, getRobotTrades, getUserTrades, getUserBacktests,
  getUserRiskSettings, getMarketplaceListings, getSocialFeed, getAllUsers,
  getRobotBrain, getBrainDecisions, getPortfolioAssets, getFinancialGoals,
  getDailyPnl, upsertRobotBrain, addBrainDecision, addPortfolioAsset,
  updatePortfolioAsset, deletePortfolioAsset, addFinancialGoal,
  updateFinancialGoal, getAiConversation, saveAiConversation,
  updateRiskSettings, toggleRobotMode, resolveDecision, getAggregatedPnl,
  getPortfolioSummary, getTradesSummary, getGoalProjections,
  getBrokerConnections, addBrokerConnection, removeBrokerConnection, syncBrokerConnection,
  getPaperTrades, getPaperStats, openPaperTrade, closePaperTrade, resetPaperTrades,
  getUserByEmail, createLocalUser, createBacktest,
  getWatchlist, addWatchlistItem, removeWatchlistItem, getSystemStats
} from "./db";
import { chatComplete, isLLMConfigured } from "./llm";
import { rateLimit } from "./rateLimit";
import { runMonteCarloBacktest } from "./backtest";
import { computeAllocation } from "./allocation";
import { analyzeSeries } from "./signals";
import { isMarketDataConfigured, fetchDailyHistory } from "./marketData";

// Strip secrets before sending a user to the client.
function toPublicUser(user: User | null) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  void passwordHash;
  return safe;
}

async function setSessionCookie(ctx: TrpcContext, user: User) {
  const token = await sdk.signSession(
    { openId: user.openId, appId: ENV.appId || "boottrade", name: user.name || "" },
    { expiresInMs: ONE_YEAR_MS },
  );
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => toPublicUser(opts.ctx.user)),
    register: publicProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(320),
        password: z.string().min(8).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.toLowerCase();
        const existing = await getUserByEmail(email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await createLocalUser({ openId: `local:${nanoid()}`, email, name: input.name, passwordHash });
        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar a conta." });
        }
        await setSessionCookie(ctx, user);
        return toPublicUser(user);
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string().trim().email().max(320),
        password: z.string().min(1).max(200),
      }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.toLowerCase();
        // Throttle credential stuffing per email.
        rateLimit(`auth.login:${email}`, 10, 60_000);
        const user = await getUserByEmail(email);
        const ok = user && (await verifyPassword(input.password, user.passwordHash));
        if (!user || !ok) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        await setSessionCookie(ctx, user);
        return toPublicUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  robots: router({
    list: publicProcedure.query(async () => {
      return getAllRobots();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return getRobotById(input.id);
      }),
    trades: protectedProcedure
      .input(z.object({ robotId: z.number(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return getRobotTrades(ctx.user.id, input.robotId, input.limit ?? 100);
      }),
  }),

  brain: router({
    get: protectedProcedure
      .input(z.object({ robotId: z.number() }))
      .query(async ({ ctx, input }) => {
        return getRobotBrain(ctx.user.id, input.robotId);
      }),
    decisions: protectedProcedure
      .input(z.object({ robotId: z.number(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return getBrainDecisions(ctx.user.id, input.robotId, input.limit || 50);
      }),
    toggleMode: protectedProcedure
      .input(z.object({ robotId: z.number(), mode: z.enum(["manual", "semi_auto", "auto"]) }))
      .mutation(async ({ ctx, input }) => {
        return toggleRobotMode(ctx.user.id, input.robotId, input.mode);
      }),
    addDecision: protectedProcedure
      .input(z.object({
        robotId: z.number(),
        decision: z.enum(["buy", "sell", "hold", "close"]),
        asset: z.string(),
        confidence: z.number(),
        reasoning: z.string().optional(),
        executedBy: z.enum(["human", "robot"]).optional(),
        outcome: z.enum(["profit", "loss", "neutral", "pending"]).optional(),
        profitAmount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return addBrainDecision(ctx.user.id, input.robotId, input);
      }),
    resolveDecision: protectedProcedure
      .input(z.object({
        decisionId: z.number(),
        outcome: z.enum(["profit", "loss", "neutral"]),
        profitAmount: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        return resolveDecision(ctx.user.id, input.decisionId, input.outcome, input.profitAmount);
      }),
    getLearningData: protectedProcedure
      .input(z.object({ robotId: z.number() }))
      .query(async ({ ctx, input }) => {
        const brain = await getRobotBrain(ctx.user.id, input.robotId);
        if (!brain) return null;
        return brain.learningData || { bestAssets: {}, bestHours: {}, patterns: [] };
      }),
    analyzeAsset: protectedProcedure
      .input(z.object({
        robotId: z.number(),
        symbol: z.string().trim().min(1).max(20),
        range: z.enum(["1y", "2y", "5y", "10y"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!isMarketDataConfigured()) {
          return { configured: false as const, signal: null, decision: null, symbol: input.symbol, message: "Feed de mercado não configurado. Defina BRAPI_TOKEN para o robô analisar ativos." };
        }
        const history = await fetchDailyHistory(input.symbol, input.range ?? "5y");
        const signal = analyzeSeries(history.points);
        if (!signal) {
          return { configured: true as const, signal: null, decision: null, symbol: history.symbol, message: "Dados insuficientes para gerar um sinal." };
        }
        const decision = signal.trend === "alta" ? "buy" : signal.trend === "baixa" ? "sell" : "hold";
        await addBrainDecision(ctx.user.id, input.robotId, {
          decision,
          asset: history.symbol,
          confidence: signal.trendStrength,
          reasoning: signal.summary,
          executedBy: "robot",
          outcome: "pending",
        });
        return { configured: true as const, signal, decision, symbol: history.symbol, message: null };
      }),
  }),

  trades: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getUserTrades(ctx.user.id, input?.limit || 20);
      }),
  }),

  pnl: router({
    daily: protectedProcedure
      .input(z.object({ robotId: z.number().optional(), days: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getDailyPnl(ctx.user.id, input?.robotId, input?.days || 30);
      }),
    aggregated: protectedProcedure
      .input(z.object({ period: z.enum(["week", "month", "all"]), robotId: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const data = await getAggregatedPnl(ctx.user.id, input.period, input.robotId);
        // Compute aggregations
        const totalNetProfit = data.reduce((sum, d) => sum + parseFloat(String(d.netProfit || "0")), 0);
        const totalTrades = data.reduce((sum, d) => sum + (d.totalTrades || 0), 0);
        const totalWins = data.reduce((sum, d) => sum + (d.winTrades || 0), 0);
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
        return { data, totalNetProfit, totalTrades, totalWins, winRate, period: input.period };
      }),
  }),

  backtests: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserBacktests(ctx.user.id);
    }),
    run: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(1).max(200),
        market: z.enum(["dolar", "acoes", "daytrade", "cripto", "apostas", "forex", "indices"]),
        initialCapital: z.number().positive().max(1e12),
        numTrades: z.number().int().min(1).max(5000),
        winRate: z.number().min(0).max(100),
        payoffRatio: z.number().positive().max(100),
        riskPerTrade: z.number().positive().max(100),
        simulations: z.number().int().min(1).max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = runMonteCarloBacktest(input);
        await createBacktest(ctx.user.id, {
          name: input.name,
          market: input.market,
          initialCapital: input.initialCapital,
          finalCapital: result.finalCapital,
          totalReturn: result.totalReturn,
          maxDrawdown: result.maxDrawdown,
          winRate: result.winRate,
          profitFactor: result.profitFactor,
          totalTrades: input.numTrades,
          results: { params: input, ...result },
        });
        return result;
      }),
  }),

  risk: router({
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      return getUserRiskSettings(ctx.user.id);
    }),
    updateSettings: protectedProcedure
      .input(z.object({
        maxDailyLoss: z.number().optional(),
        maxDrawdown: z.number().optional(),
        defaultStopLoss: z.number().optional(),
        defaultTakeProfit: z.number().optional(),
        maxOpenPositions: z.number().optional(),
        maxLeverage: z.number().optional(),
        autoStopEnabled: z.boolean().optional(),
        alertsEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateRiskSettings(ctx.user.id, input);
      }),
  }),

  portfolio: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPortfolioAssets(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({
        assetClass: z.enum(["acoes", "renda_fixa", "fundos", "cripto", "cdb", "tesouro", "fii", "internacional"]),
        name: z.string(),
        ticker: z.string().optional(),
        institution: z.string().optional(),
        quantity: z.number().optional(),
        avgPrice: z.number().optional(),
        currentPrice: z.number().optional(),
        totalInvested: z.number().optional(),
        currentValue: z.number().optional(),
        riskProfile: z.enum(["conservador", "moderado", "arrojado", "agressivo"]).optional(),
        horizon: z.enum(["curto", "medio", "longo"]).optional(),
        yieldRate: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return addPortfolioAsset(ctx.user.id, input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        currentPrice: z.number().optional(),
        currentValue: z.number().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updatePortfolioAsset(ctx.user.id, input.id, input);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deletePortfolioAsset(ctx.user.id, input.id);
      }),
  }),

  goals: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getFinancialGoals(ctx.user.id);
    }),
    projections: protectedProcedure.query(async ({ ctx }) => {
      return getGoalProjections(ctx.user.id);
    }),
    add: protectedProcedure
      .input(z.object({
        title: z.string(),
        targetAmount: z.number(),
        deadline: z.string().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        category: z.enum(["patrimonio", "renda_passiva", "aposentadoria", "emergencia", "projeto", "outro"]).optional(),
        monthlyContribution: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return addFinancialGoal(ctx.user.id, input);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        currentAmount: z.number().optional(),
        status: z.enum(["active", "completed", "paused"]).optional(),
        monthlyContribution: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return updateFinancialGoal(ctx.user.id, input.id, input);
      }),
  }),

  ai: router({
    chat: protectedProcedure
      .input(z.object({
        message: z.string().min(1).max(2000),
        context: z.enum(["consultor", "auditor", "mercado", "operacao"]).optional(),
        conversationId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Cap LLM spend: 15 messages/minute per user.
        rateLimit(`ai.chat:${ctx.user.id}`, 15, 60_000);
        // Fetch user's real data for context
        const portfolioData = await getPortfolioSummary(ctx.user.id);
        const tradesData = await getTradesSummary(ctx.user.id);
        const goalsData = await getGoalProjections(ctx.user.id);

        const portfolioContext = portfolioData.totalCurrent > 0
          ? `\n\nDados reais da carteira do usuário:\n- Patrimônio total investido: R$ ${portfolioData.totalInvested.toFixed(2)}\n- Valor atual: R$ ${portfolioData.totalCurrent.toFixed(2)}\n- P&L total: R$ ${portfolioData.totalPnl.toFixed(2)} (${portfolioData.totalInvested > 0 ? ((portfolioData.totalPnl / portfolioData.totalInvested) * 100).toFixed(1) : 0}%)\n- Alocação: ${Object.entries(portfolioData.allocation).map(([k, v]) => `${k}: R$ ${v.toFixed(2)}`).join(", ")}\n- Ativos: ${portfolioData.assets.map(a => `${a.name} (${a.assetClass}): R$ ${parseFloat(String(a.currentValue || "0")).toFixed(2)}`).slice(0, 10).join(", ")}`
          : "";

        const tradesContext = tradesData.totalTrades > 0
          ? `\n\nHistórico de trades do usuário:\n- Total de trades: ${tradesData.totalTrades}\n- Win rate: ${tradesData.winRate.toFixed(1)}%\n- Lucro total: R$ ${tradesData.totalProfit.toFixed(2)}\n- Últimos trades: ${tradesData.trades.map(t => `${t.type} ${t.asset} (${t.status}, P&L: R$ ${parseFloat(String(t.profit || "0")).toFixed(2)})`).join(", ")}`
          : "";

        const goalsContext = goalsData.length > 0
          ? `\n\nMetas financeiras do usuário:\n${goalsData.map(g => `- ${g.title}: R$ ${parseFloat(String(g.currentAmount || "0")).toFixed(2)} / R$ ${parseFloat(String(g.targetAmount || "0")).toFixed(2)} (${g.progress.toFixed(1)}% concluído${g.monthsToGoal ? `, ~${g.monthsToGoal} meses restantes` : ""})`).join("\n")}`
          : "";

        const systemPrompts: Record<string, string> = {
          consultor: `Você é um consultor financeiro especialista. Analise o patrimônio REAL do usuário (dados abaixo) e sugira alocações em curto, médio e longo prazo. Considere perfis conservador, moderado e arrojado. Forneça recomendações específicas sobre ações, CDB, fundos, tesouro, FIIs e criptomoedas. Sempre explique os riscos envolvidos. Use os dados reais para personalizar suas recomendações. Responda em português brasileiro.${portfolioContext}${goalsContext}`,
          auditor: `Você é um auditor financeiro que acompanha cada operação do usuário. Analise os trades REAIS (dados abaixo), identifique padrões de erro, sugira melhorias na estratégia e alerte sobre riscos. Seja preciso com números e percentuais. Use os dados reais para fundamentar suas análises. Responda em português brasileiro.${tradesContext}${portfolioContext}`,
          mercado: `Você é um analista de mercado especializado em tendências nacionais e internacionais. Forneça análises sobre cenários econômicos, oportunidades de investimento, movimentações de mercado e previsões. Considere o portfólio atual do usuário para contextualizar. Responda em português brasileiro.${portfolioContext}`,
          operacao: `Você é um assistente de operações de trading. Ajude o usuário a tomar decisões sobre compra/venda, analise pontos de entrada e saída, calcule risk/reward e sugira stop loss e take profit. Considere o histórico real de trades e o perfil de risco do usuário. Responda em português brasileiro.${tradesContext}${portfolioContext}`,
        };

        const context = input.context || "consultor";
        const messages = [
          { role: "system" as const, content: systemPrompts[context] },
          { role: "user" as const, content: input.message },
        ];

        if (!isLLMConfigured()) {
          return {
            response: "O Consultor IA ainda não está configurado neste ambiente. Defina OPENAI_API_KEY (ou outro provedor compatível via LLM_BASE_URL/LLM_MODEL) no servidor para ativar as respostas.",
            conversationId: input.conversationId,
          };
        }

        try {
          const assistantMessage = (await chatComplete(messages)) || "Desculpe, não consegui processar sua solicitação no momento.";

          // Save conversation
          if (input.conversationId) {
            await saveAiConversation(ctx.user.id, input.conversationId, input.message, assistantMessage);
          }

          return { response: assistantMessage, conversationId: input.conversationId };
        } catch (error) {
          console.error("[AI] chat failed:", error);
          return { response: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.", conversationId: input.conversationId };
        }
      }),
    getConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return getAiConversation(ctx.user.id, input.id);
      }),
    advise: protectedProcedure
      .input(z.object({
        topic: z.enum(["risco", "alocacao", "operacao", "tecnologia", "geral"]),
        context: z.string().min(1).max(8000),
      }))
      .mutation(async ({ ctx, input }) => {
        rateLimit(`ai.advise:${ctx.user.id}`, 20, 60_000);
        if (!isLLMConfigured()) {
          return { configured: false as const, response: "O Consultor IA ainda não está configurado. Defina OPENAI_API_KEY no servidor para ativar as orientações." };
        }
        const base = "Responda em português brasileiro, de forma direta, específica e acionável (use listas e prioridades). Foque em segurança e em passos concretos. Deixe claro que são orientações, não garantias.";
        const prompts: Record<string, string> = {
          risco: `Você é um consultor de gestão de risco para trading. Com base nas configurações e métricas REAIS abaixo, aponte: (1) o que está perigoso ou mal calibrado, (2) o que corrigir imediatamente, (3) como evoluir para minimizar risco, (4) oportunidades de melhoria. ${base}`,
          alocacao: `Você é um consultor financeiro. Com base no plano de alocação e perfil REAIS abaixo, avalie a distribuição, aponte o que corrigir e como potencializar resultados respeitando o risco, e sugira ativos/classes específicos. ${base}`,
          operacao: `Você é um assistente de operações de trading. Com base nos dados REAIS abaixo, oriente sobre entradas/saídas, risk/reward, stop e alvo. ${base}`,
          tecnologia: `Você é um auditor técnico de software sênior. Com base no diagnóstico REAL do sistema abaixo, aponte: falhas, vulnerabilidades, pontos críticos, o que melhorar, o que criar, o que editar e o que remover — priorizado por impacto e risco. ${base}`,
          geral: `Você é um consultor especialista. Analise os dados REAIS abaixo e oriente o usuário. ${base}`,
        };
        const messages = [
          { role: "system" as const, content: prompts[input.topic] },
          { role: "user" as const, content: input.context },
        ];
        try {
          const response = (await chatComplete(messages)) || "Não consegui gerar a orientação agora. Tente novamente.";
          return { configured: true as const, response };
        } catch (error) {
          console.error("[AI] advise failed:", error);
          return { configured: true as const, response: "Ocorreu um erro ao consultar a IA. Tente novamente." };
        }
      }),
  }),

  watchlist: router({
    list: protectedProcedure.query(async ({ ctx }) => getWatchlist(ctx.user.id)),
    add: protectedProcedure
      .input(z.object({ symbol: z.string().trim().min(1).max(20), label: z.string().max(100).optional() }))
      .mutation(async ({ ctx, input }) => addWatchlistItem(ctx.user.id, input.symbol, input.label)),
    remove: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => removeWatchlistItem(ctx.user.id, input.id)),
  }),

  market: router({
    configured: protectedProcedure.query(() => ({ configured: isMarketDataConfigured() })),
    scan: protectedProcedure
      .input(z.object({ symbols: z.array(z.string().trim().min(1).max(20)).min(1).max(12), range: z.enum(["1y", "2y", "5y", "10y"]).optional() }))
      .mutation(async ({ input }) => {
        if (!isMarketDataConfigured()) {
          return { configured: false as const, results: [], message: "Feed de mercado não configurado. Defina BRAPI_TOKEN no servidor." };
        }
        const results: { symbol: string; name: string; trend: string; trendStrength: number; oneYear: number | null; lastPrice: number; score: number; error?: string }[] = [];
        for (const sym of input.symbols) {
          try {
            const history = await fetchDailyHistory(sym, input.range ?? "5y");
            const signal = analyzeSeries(history.points);
            if (!signal) { results.push({ symbol: sym, name: sym, trend: "—", trendStrength: 0, oneYear: null, lastPrice: 0, score: 0, error: "sem dados" }); continue; }
            const oneYear = signal.returns.find(r => r.days === 252)?.percent ?? null;
            const dir = signal.trend === "alta" ? 1 : signal.trend === "baixa" ? -1 : 0;
            results.push({ symbol: history.symbol, name: history.name, trend: signal.trend, trendStrength: signal.trendStrength, oneYear, lastPrice: signal.lastPrice, score: dir * signal.trendStrength });
          } catch {
            results.push({ symbol: sym, name: sym, trend: "—", trendStrength: 0, oneYear: null, lastPrice: 0, score: 0, error: "falha ao buscar" });
          }
        }
        results.sort((a, b) => b.score - a.score);
        return { configured: true as const, results, message: null };
      }),
    analyze: protectedProcedure
      .input(z.object({ symbol: z.string().trim().min(1).max(20), range: z.enum(["1y", "2y", "5y", "10y"]).optional() }))
      .mutation(async ({ input }) => {
        if (!isMarketDataConfigured()) {
          return { configured: false as const, symbol: input.symbol, name: input.symbol, signal: null, message: "Feed de mercado não configurado. Defina BRAPI_TOKEN no servidor para ativar a análise de tendências." };
        }
        const history = await fetchDailyHistory(input.symbol, input.range ?? "5y");
        const signal = analyzeSeries(history.points);
        return { configured: true as const, symbol: history.symbol, name: history.name, signal, message: signal ? null : "Dados insuficientes para análise." };
      }),
  }),

  allocation: router({
    recommend: protectedProcedure
      .input(z.object({
        amount: z.number().positive().max(1e12),
        riskProfile: z.enum(["conservador", "moderado", "arrojado", "agressivo"]),
        horizon: z.enum(["curto", "medio", "longo"]),
        objective: z.enum(["crescimento", "renda", "protecao", "aposentadoria"]),
        monthlyIncome: z.number().nonnegative().optional(),
        emergencyFund: z.number().nonnegative().optional(),
      }))
      .mutation(async ({ input }) => {
        return computeAllocation(input);
      }),
  }),

  marketplace: router({
    list: publicProcedure.query(async () => {
      return getMarketplaceListings();
    }),
  }),

  social: router({
    feed: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getSocialFeed(input?.limit || 20);
      }),
  }),

  admin: router({
    users: adminProcedure.query(async () => {
      const users = await getAllUsers();
      return users.map(toPublicUser);
    }),
    diagnostics: adminProcedure.query(async () => {
      const stats = await getSystemStats();
      return {
        dbConnected: stats !== null,
        llmConfigured: isLLMConfigured(),
        marketDataConfigured: isMarketDataConfigured(),
        counts: stats ?? { users: 0, robots: 0, trades: 0, brokers: 0, backtests: 0 },
        security: {
          brokerCredentialsEncrypted: true,
          internalErrorsMasked: true,
          aiRateLimited: true,
        },
      };
    }),
  }),

  paper: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getPaperTrades(ctx.user.id);
    }),
    stats: protectedProcedure.query(async ({ ctx }) => {
      return getPaperStats(ctx.user.id);
    }),
    open: protectedProcedure
      .input(z.object({
        asset: z.string().min(1).max(50),
        market: z.enum(["dolar", "acoes", "daytrade", "cripto", "apostas", "forex", "indices"]),
        type: z.enum(["buy", "sell"]),
        quantity: z.number().positive(),
        entryPrice: z.number().positive(),
        stopLoss: z.number().positive().optional(),
        takeProfit: z.number().positive().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return openPaperTrade(ctx.user.id, input);
      }),
    close: protectedProcedure
      .input(z.object({ id: z.number(), exitPrice: z.number().positive() }))
      .mutation(async ({ ctx, input }) => {
        return closePaperTrade(ctx.user.id, input.id, input.exitPrice);
      }),
    reset: protectedProcedure.mutation(async ({ ctx }) => {
      return resetPaperTrades(ctx.user.id);
    }),
  }),

  brokers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getBrokerConnections(ctx.user.id);
    }),
    connect: protectedProcedure
      .input(z.object({ broker: z.string().min(1).max(50), credentials: z.string().min(1).max(4096) }))
      .mutation(async ({ ctx, input }) => {
        return addBrokerConnection(ctx.user.id, input.broker, input.credentials);
      }),
    disconnect: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return removeBrokerConnection(ctx.user.id, input.id);
      }),
    sync: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return syncBrokerConnection(ctx.user.id, input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
