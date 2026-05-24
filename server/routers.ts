import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { z } from "zod";
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
  getPaperTrades, getPaperStats, openPaperTrade, closePaperTrade, resetPaperTrades
} from "./db";
import { invokeLLM } from "./_core/llm";
import { rateLimit } from "./rateLimit";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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

        try {
          const response = await invokeLLM({ messages });
          const rawContent = response.choices?.[0]?.message?.content;
          const assistantMessage = (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent)) || "Desculpe, não consegui processar sua solicitação no momento.";

          // Save conversation
          if (input.conversationId) {
            await saveAiConversation(ctx.user.id, input.conversationId, input.message, assistantMessage);
          }

          return { response: assistantMessage, conversationId: input.conversationId };
        } catch (error) {
          return { response: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.", conversationId: input.conversationId };
        }
      }),
    getConversation: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return getAiConversation(ctx.user.id, input.id);
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
      return getAllUsers();
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
