import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, robots, trades, backtests, riskSettings,
  marketplaceListings, socialPosts, copyTrades, userRobots,
  robotBrain, brainDecisions, portfolioAssets, financialGoals,
  aiConversations, dailyPnl, brokerConnections
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { encryptSecret } from './crypto';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Robot queries
export async function getAllRobots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(robots).orderBy(desc(robots.iaScore)).limit(200);
}

export async function getRobotById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(robots).where(eq(robots.id, id)).limit(1);
  return result[0];
}

// Robot Brain queries
export async function getRobotBrain(userId: number, robotId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(robotBrain)
    .where(and(eq(robotBrain.userId, userId), eq(robotBrain.robotId, robotId)))
    .limit(1);
  if (result.length === 0) {
    // Auto-create brain for this robot
    await db.insert(robotBrain).values({ userId, robotId });
    const newResult = await db.select().from(robotBrain)
      .where(and(eq(robotBrain.userId, userId), eq(robotBrain.robotId, robotId)))
      .limit(1);
    return newResult[0];
  }
  return result[0];
}

export async function getBrainDecisions(userId: number, robotId: number, limit: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brainDecisions)
    .where(and(eq(brainDecisions.userId, userId), eq(brainDecisions.robotId, robotId)))
    .orderBy(desc(brainDecisions.createdAt))
    .limit(limit);
}

export async function toggleRobotMode(userId: number, robotId: number, mode: "manual" | "semi_auto" | "auto") {
  const db = await getDb();
  if (!db) return { success: false };
  await db.update(robotBrain)
    .set({ mode })
    .where(and(eq(robotBrain.userId, userId), eq(robotBrain.robotId, robotId)));
  return { success: true, mode };
}

export async function upsertRobotBrain(userId: number, robotId: number, data: any) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(robotBrain)
    .where(and(eq(robotBrain.userId, userId), eq(robotBrain.robotId, robotId)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(robotBrain).values({ userId, robotId, ...data });
  } else {
    await db.update(robotBrain).set(data)
      .where(and(eq(robotBrain.userId, userId), eq(robotBrain.robotId, robotId)));
  }
}

export async function addBrainDecision(userId: number, robotId: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  // Get brain
  const brain = await getRobotBrain(userId, robotId);
  if (!brain) return { success: false };

  await db.insert(brainDecisions).values({
    brainId: brain.id,
    robotId,
    userId,
    decision: data.decision,
    asset: data.asset,
    confidence: data.confidence.toString(),
    reasoning: data.reasoning,
    executedBy: data.executedBy || "human",
    outcome: data.outcome || "pending",
    profitAmount: data.profitAmount ? data.profitAmount.toString() : null,
  });

  // Update brain stats
  const newTotal = (brain.totalDecisions || 0) + 1;
  const newMaturity = Math.min(10, Math.floor(newTotal / 10) + 1);
  await db.update(robotBrain).set({
    totalDecisions: newTotal,
    maturityLevel: newMaturity,
    lastDecisionAt: new Date(),
  }).where(eq(robotBrain.id, brain.id));

  return { success: true, maturityLevel: newMaturity };
}

// Resolve a pending decision with outcome and update assertiveness
export async function resolveDecision(userId: number, decisionId: number, outcome: "profit" | "loss" | "neutral", profitAmount: number) {
  const db = await getDb();
  if (!db) return { success: false };

  // Get the decision
  const decisionResult = await db.select().from(brainDecisions)
    .where(and(eq(brainDecisions.id, decisionId), eq(brainDecisions.userId, userId)))
    .limit(1);
  if (decisionResult.length === 0) return { success: false };
  const decision = decisionResult[0];

  // Update decision outcome
  await db.update(brainDecisions).set({
    outcome,
    profitAmount: profitAmount.toString(),
  }).where(eq(brainDecisions.id, decisionId));

  // Recalculate brain assertiveness
  const brain = await getRobotBrain(userId, decision.robotId);
  if (!brain) return { success: false };

  const isCorrect = outcome === "profit";
  const newCorrect = (brain.correctDecisions || 0) + (isCorrect ? 1 : 0);
  const newTotal = brain.totalDecisions || 1;
  const newAssertiveness = (newCorrect / newTotal) * 100;

  // Update learning data with patterns
  const existingLearning = (brain.learningData as any) || { patterns: [], bestAssets: {}, bestHours: {}, weeklyProgress: [] };
  const assetKey = decision.asset;
  if (!existingLearning.bestAssets) existingLearning.bestAssets = {};
  if (!existingLearning.bestAssets[assetKey]) existingLearning.bestAssets[assetKey] = { wins: 0, losses: 0, profit: 0 };
  if (isCorrect) existingLearning.bestAssets[assetKey].wins += 1;
  else existingLearning.bestAssets[assetKey].losses += 1;
  existingLearning.bestAssets[assetKey].profit += profitAmount;

  // Track hour patterns
  const hour = new Date().getHours();
  if (!existingLearning.bestHours) existingLearning.bestHours = {};
  if (!existingLearning.bestHours[hour]) existingLearning.bestHours[hour] = { wins: 0, losses: 0 };
  if (isCorrect) existingLearning.bestHours[hour].wins += 1;
  else existingLearning.bestHours[hour].losses += 1;

  await db.update(robotBrain).set({
    correctDecisions: newCorrect,
    assertiveness: newAssertiveness.toFixed(2),
    learningData: JSON.stringify(existingLearning),
  }).where(eq(robotBrain.id, brain.id));

  return { success: true, assertiveness: newAssertiveness, maturityLevel: brain.maturityLevel };
}

// Get aggregated P&L (weekly/monthly)
export async function getAggregatedPnl(userId: number, period: "week" | "month" | "all", robotId?: number) {
  const db = await getDb();
  if (!db) return [];
  const results = robotId
    ? await db.select().from(dailyPnl)
        .where(and(eq(dailyPnl.userId, userId), eq(dailyPnl.robotId, robotId)))
        .orderBy(desc(dailyPnl.date))
        .limit(period === "week" ? 7 : period === "month" ? 30 : 365)
    : await db.select().from(dailyPnl)
        .where(eq(dailyPnl.userId, userId))
        .orderBy(desc(dailyPnl.date))
        .limit(period === "week" ? 7 : period === "month" ? 30 : 365);
  return results;
}

// Get portfolio summary for AI context
export async function getPortfolioSummary(userId: number) {
  const db = await getDb();
  if (!db) return { assets: [], totalInvested: 0, totalCurrent: 0, totalPnl: 0, allocation: {} };
  const assets = await db.select().from(portfolioAssets).where(eq(portfolioAssets.userId, userId));
  const totalInvested = assets.reduce((sum, a) => sum + parseFloat(String(a.totalInvested || "0")), 0);
  const totalCurrent = assets.reduce((sum, a) => sum + parseFloat(String(a.currentValue || "0")), 0);
  const totalPnl = totalCurrent - totalInvested;
  const allocation: Record<string, number> = {};
  assets.forEach(a => {
    const cls = a.assetClass;
    allocation[cls] = (allocation[cls] || 0) + parseFloat(String(a.currentValue || "0"));
  });
  return { assets, totalInvested, totalCurrent, totalPnl, allocation };
}

// Get recent trades summary for AI context
export async function getTradesSummary(userId: number) {
  const db = await getDb();
  if (!db) return { trades: [], totalProfit: 0, winRate: 0, totalTrades: 0 };
  const recentTrades = await db.select().from(trades)
    .where(eq(trades.userId, userId))
    .orderBy(desc(trades.openedAt))
    .limit(50);
  const closedTrades = recentTrades.filter(t => t.status === "closed");
  const totalProfit = closedTrades.reduce((sum, t) => sum + parseFloat(String(t.profit || "0")), 0);
  const wins = closedTrades.filter(t => parseFloat(String(t.profit || "0")) > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
  return { trades: recentTrades.slice(0, 10), totalProfit, winRate, totalTrades: closedTrades.length };
}

// Get goal projections
export async function getGoalProjections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const goals = await db.select().from(financialGoals)
    .where(and(eq(financialGoals.userId, userId), eq(financialGoals.status, "active")));
  return goals.map(g => {
    const target = parseFloat(String(g.targetAmount || "0"));
    const current = parseFloat(String(g.currentAmount || "0"));
    const monthly = parseFloat(String(g.monthlyContribution || "0"));
    const remaining = target - current;
    const monthsToGoal = monthly > 0 ? Math.ceil(remaining / monthly) : null;
    const progress = target > 0 ? (current / target) * 100 : 0;
    const projectedDate = monthsToGoal ? new Date(Date.now() + monthsToGoal * 30 * 24 * 60 * 60 * 1000) : null;
    return { ...g, progress, monthsToGoal, projectedDate, remaining };
  });
}

// Trade queries
export async function getUserTrades(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(trades).where(eq(trades.userId, userId)).orderBy(desc(trades.openedAt)).limit(limit);
}

// Daily PnL
export async function getDailyPnl(userId: number, robotId?: number, days = 30) {
  const db = await getDb();
  if (!db) return [];
  if (robotId) {
    return db.select().from(dailyPnl)
      .where(and(eq(dailyPnl.userId, userId), eq(dailyPnl.robotId, robotId)))
      .orderBy(desc(dailyPnl.date))
      .limit(days);
  }
  return db.select().from(dailyPnl)
    .where(eq(dailyPnl.userId, userId))
    .orderBy(desc(dailyPnl.date))
    .limit(days);
}

// Backtest queries
export async function getUserBacktests(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backtests).where(eq(backtests.userId, userId)).orderBy(desc(backtests.createdAt)).limit(100);
}

// Risk settings
export async function getUserRiskSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(riskSettings).where(eq(riskSettings.userId, userId)).limit(1);
  return result[0];
}

export async function updateRiskSettings(userId: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  const existing = await db.select().from(riskSettings).where(eq(riskSettings.userId, userId)).limit(1);
  const setData: any = {};
  if (data.maxDailyLoss !== undefined) setData.maxDailyLoss = data.maxDailyLoss.toString();
  if (data.maxDrawdown !== undefined) setData.maxDrawdown = data.maxDrawdown.toString();
  if (data.defaultStopLoss !== undefined) setData.defaultStopLoss = data.defaultStopLoss.toString();
  if (data.defaultTakeProfit !== undefined) setData.defaultTakeProfit = data.defaultTakeProfit.toString();
  if (data.maxOpenPositions !== undefined) setData.maxOpenPositions = data.maxOpenPositions;
  if (data.maxLeverage !== undefined) setData.maxLeverage = data.maxLeverage.toString();
  if (data.autoStopEnabled !== undefined) setData.autoStopEnabled = data.autoStopEnabled;
  if (data.alertsEnabled !== undefined) setData.alertsEnabled = data.alertsEnabled;

  if (existing.length === 0) {
    await db.insert(riskSettings).values({ userId, ...setData });
  } else {
    await db.update(riskSettings).set(setData).where(eq(riskSettings.userId, userId));
  }
  return { success: true };
}

// Portfolio
export async function getPortfolioAssets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolioAssets).where(eq(portfolioAssets.userId, userId)).orderBy(desc(portfolioAssets.currentValue)).limit(500);
}

export async function addPortfolioAsset(userId: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  const values: any = {
    userId,
    assetClass: data.assetClass,
    name: data.name,
  };
  if (data.ticker) values.ticker = data.ticker;
  if (data.institution) values.institution = data.institution;
  if (data.quantity) values.quantity = data.quantity.toString();
  if (data.avgPrice) values.avgPrice = data.avgPrice.toString();
  if (data.currentPrice) values.currentPrice = data.currentPrice.toString();
  if (data.totalInvested) values.totalInvested = data.totalInvested.toString();
  if (data.currentValue) values.currentValue = data.currentValue.toString();
  if (data.riskProfile) values.riskProfile = data.riskProfile;
  if (data.horizon) values.horizon = data.horizon;
  if (data.yieldRate) values.yieldRate = data.yieldRate.toString();
  if (data.notes) values.notes = data.notes;

  // Calculate P&L
  if (data.totalInvested && data.currentValue) {
    values.profitLoss = (data.currentValue - data.totalInvested).toString();
    values.profitPercent = (((data.currentValue - data.totalInvested) / data.totalInvested) * 100).toString();
  }

  await db.insert(portfolioAssets).values(values);
  return { success: true };
}

export async function updatePortfolioAsset(userId: number, id: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  const setData: any = {};
  if (data.currentPrice !== undefined) setData.currentPrice = data.currentPrice.toString();
  if (data.currentValue !== undefined) setData.currentValue = data.currentValue.toString();
  if (data.notes !== undefined) setData.notes = data.notes;
  await db.update(portfolioAssets).set(setData)
    .where(and(eq(portfolioAssets.id, id), eq(portfolioAssets.userId, userId)));
  return { success: true };
}

export async function deletePortfolioAsset(userId: number, id: number) {
  const db = await getDb();
  if (!db) return { success: false };
  await db.delete(portfolioAssets)
    .where(and(eq(portfolioAssets.id, id), eq(portfolioAssets.userId, userId)));
  return { success: true };
}

// Financial Goals
export async function getFinancialGoals(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialGoals).where(eq(financialGoals.userId, userId)).orderBy(desc(financialGoals.createdAt)).limit(200);
}

export async function addFinancialGoal(userId: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  const values: any = {
    userId,
    title: data.title,
    targetAmount: data.targetAmount.toString(),
  };
  if (data.deadline) values.deadline = new Date(data.deadline);
  if (data.priority) values.priority = data.priority;
  if (data.category) values.category = data.category;
  if (data.monthlyContribution) values.monthlyContribution = data.monthlyContribution.toString();
  await db.insert(financialGoals).values(values);
  return { success: true };
}

export async function updateFinancialGoal(userId: number, id: number, data: any) {
  const db = await getDb();
  if (!db) return { success: false };
  const setData: any = {};
  if (data.currentAmount !== undefined) setData.currentAmount = data.currentAmount.toString();
  if (data.status !== undefined) setData.status = data.status;
  if (data.monthlyContribution !== undefined) setData.monthlyContribution = data.monthlyContribution.toString();
  await db.update(financialGoals).set(setData)
    .where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));
  return { success: true };
}

// AI Conversations
export async function getAiConversation(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, userId)))
    .limit(1);
  return result[0];
}

export async function saveAiConversation(userId: number, conversationId: number, userMessage: string, assistantMessage: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1);

  const newMessages = [
    { role: "user", content: userMessage, timestamp: Date.now() },
    { role: "assistant", content: assistantMessage, timestamp: Date.now() },
  ];

  if (existing.length === 0) {
    await db.insert(aiConversations).values({
      userId,
      messages: JSON.stringify(newMessages),
    });
  } else {
    const existingMessages = existing[0].messages ? JSON.parse(JSON.stringify(existing[0].messages)) : [];
    await db.update(aiConversations).set({
      messages: JSON.stringify([...existingMessages, ...newMessages]),
    }).where(eq(aiConversations.id, conversationId));
  }
}

// Marketplace
export async function getMarketplaceListings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(marketplaceListings).where(eq(marketplaceListings.isActive, true)).orderBy(desc(marketplaceListings.totalSubscribers)).limit(200);
}

// Social posts
export async function getSocialFeed(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(socialPosts).orderBy(desc(socialPosts.createdAt)).limit(limit);
}

// Admin queries
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(1000);
}

// Broker Connections
export async function getBrokerConnections(userId: number) {
  const db = await getDb();
  if (!db) return [];
  // Never expose the encrypted `credentials` column to callers/clients.
  return db.select({
    id: brokerConnections.id,
    userId: brokerConnections.userId,
    broker: brokerConnections.broker,
    status: brokerConnections.status,
    accountId: brokerConnections.accountId,
    lastSync: brokerConnections.lastSync,
    syncData: brokerConnections.syncData,
    createdAt: brokerConnections.createdAt,
    updatedAt: brokerConnections.updatedAt,
  }).from(brokerConnections).where(eq(brokerConnections.userId, userId)).orderBy(desc(brokerConnections.createdAt));
}

export async function addBrokerConnection(userId: number, broker: string, credentials: string) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(brokerConnections).values({
    userId,
    broker,
    credentials: encryptSecret(credentials),
    status: "connected",
    lastSync: new Date(),
  });
  return { success: true };
}

export async function removeBrokerConnection(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.delete(brokerConnections).where(and(eq(brokerConnections.id, id), eq(brokerConnections.userId, userId)));
  return { success: true };
}

export async function syncBrokerConnection(userId: number, id: number) {
  const db = await getDb();
  if (!db) return null;
  await db.update(brokerConnections)
    .set({ status: "syncing", lastSync: new Date() })
    .where(and(eq(brokerConnections.id, id), eq(brokerConnections.userId, userId)));
  // In production, this would trigger actual API sync with the broker
  // For now, mark as connected after "sync"
  setTimeout(async () => {
    const db2 = await getDb();
    if (db2) {
      await db2.update(brokerConnections)
        .set({ status: "connected" })
        .where(eq(brokerConnections.id, id));
    }
  }, 3000);
  return { success: true };
}
