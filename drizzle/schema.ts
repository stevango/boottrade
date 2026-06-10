import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, json, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  plan: mysqlEnum("plan", ["starter", "pro", "institutional"]).default("starter").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("10000.00"),
  avatarUrl: text("avatarUrl"),
  bio: text("bio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_unique").on(t.email),
}));

export const robots = mysqlTable("robots", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  market: mysqlEnum("market", ["dolar", "acoes", "daytrade", "cripto", "apostas", "forex", "indices"]).notNull(),
  strategy: text("strategy"),
  status: mysqlEnum("status", ["active", "paused", "testing", "archived"]).default("paused").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["low", "medium", "high", "extreme"]).default("medium").notNull(),
  winRate: decimal("winRate", { precision: 5, scale: 2 }).default("0.00"),
  totalReturn: decimal("totalReturn", { precision: 10, scale: 2 }).default("0.00"),
  drawdown: decimal("drawdown", { precision: 5, scale: 2 }).default("0.00"),
  profitFactor: decimal("profitFactor", { precision: 5, scale: 2 }).default("0.00"),
  totalTrades: int("totalTrades").default(0),
  monthlyReturn: decimal("monthlyReturn", { precision: 8, scale: 2 }).default("0.00"),
  iaScore: decimal("iaScore", { precision: 4, scale: 1 }).default("0.0"),
  config: json("config"),
  isPublic: boolean("isPublic").default(false),
  price: decimal("price", { precision: 10, scale: 2 }).default("0.00"),
  subscribers: int("subscribers").default(0),
  creatorId: int("creatorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  marketIdx: index("robots_market_idx").on(t.market),
  iaScoreIdx: index("robots_iaScore_idx").on(t.iaScore),
}));

export const userRobots = mysqlTable("user_robots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  robotId: int("robotId").notNull(),
  status: mysqlEnum("status", ["active", "paused", "stopped"]).default("active").notNull(),
  investedAmount: decimal("investedAmount", { precision: 15, scale: 2 }).default("0.00"),
  currentReturn: decimal("currentReturn", { precision: 15, scale: 2 }).default("0.00"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  stoppedAt: timestamp("stoppedAt"),
}, (t) => ({
  userIdx: index("user_robots_userId_idx").on(t.userId),
  robotIdx: index("user_robots_robotId_idx").on(t.robotId),
}));

export const trades = mysqlTable("trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  robotId: int("robotId"),
  type: mysqlEnum("type", ["buy", "sell"]).notNull(),
  asset: varchar("asset", { length: 50 }).notNull(),
  market: mysqlEnum("market", ["dolar", "acoes", "daytrade", "cripto", "apostas", "forex", "indices"]).notNull(),
  entryPrice: decimal("entryPrice", { precision: 15, scale: 6 }).notNull(),
  exitPrice: decimal("exitPrice", { precision: 15, scale: 6 }),
  quantity: decimal("quantity", { precision: 15, scale: 6 }).notNull(),
  profit: decimal("profit", { precision: 15, scale: 2 }),
  status: mysqlEnum("status", ["open", "closed", "cancelled"]).default("open").notNull(),
  isPaperTrade: boolean("isPaperTrade").default(false),
  stopLoss: decimal("stopLoss", { precision: 15, scale: 6 }),
  takeProfit: decimal("takeProfit", { precision: 15, scale: 6 }),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
}, (t) => ({
  userOpenedIdx: index("trades_userId_openedAt_idx").on(t.userId, t.openedAt),
}));

export const backtests = mysqlTable("backtests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  robotId: int("robotId"),
  name: varchar("name", { length: 200 }).notNull(),
  market: mysqlEnum("market", ["dolar", "acoes", "daytrade", "cripto", "apostas", "forex", "indices"]).notNull(),
  startDate: timestamp("startDate").notNull(),
  endDate: timestamp("endDate").notNull(),
  initialCapital: decimal("initialCapital", { precision: 15, scale: 2 }).notNull(),
  finalCapital: decimal("finalCapital", { precision: 15, scale: 2 }),
  totalReturn: decimal("totalReturn", { precision: 10, scale: 2 }),
  maxDrawdown: decimal("maxDrawdown", { precision: 5, scale: 2 }),
  winRate: decimal("winRate", { precision: 5, scale: 2 }),
  profitFactor: decimal("profitFactor", { precision: 5, scale: 2 }),
  totalTrades: int("totalTrades"),
  sharpeRatio: decimal("sharpeRatio", { precision: 5, scale: 2 }),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  results: json("results"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userCreatedIdx: index("backtests_userId_createdAt_idx").on(t.userId, t.createdAt),
}));

export const riskSettings = mysqlTable("risk_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  maxDailyLoss: decimal("maxDailyLoss", { precision: 10, scale: 2 }).default("500.00"),
  maxDrawdown: decimal("maxDrawdown", { precision: 5, scale: 2 }).default("10.00"),
  defaultStopLoss: decimal("defaultStopLoss", { precision: 5, scale: 2 }).default("2.00"),
  defaultTakeProfit: decimal("defaultTakeProfit", { precision: 5, scale: 2 }).default("4.00"),
  maxOpenPositions: int("maxOpenPositions").default(5),
  maxLeverage: decimal("maxLeverage", { precision: 5, scale: 2 }).default("10.00"),
  autoStopEnabled: boolean("autoStopEnabled").default(true),
  alertsEnabled: boolean("alertsEnabled").default(true),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("risk_settings_userId_idx").on(t.userId),
}));

export const marketplaceListings = mysqlTable("marketplace_listings", {
  id: int("id").autoincrement().primaryKey(),
  robotId: int("robotId").notNull(),
  sellerId: int("sellerId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  subscriptionType: mysqlEnum("subscriptionType", ["monthly", "yearly", "lifetime"]).default("monthly").notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  totalReviews: int("totalReviews").default(0),
  totalSubscribers: int("totalSubscribers").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  activeIdx: index("marketplace_listings_isActive_idx").on(t.isActive),
  robotIdx: index("marketplace_listings_robotId_idx").on(t.robotId),
}));

export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  tradeId: int("tradeId"),
  likes: int("likes").default(0),
  comments: int("comments").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  createdIdx: index("social_posts_createdAt_idx").on(t.createdAt),
  userIdx: index("social_posts_userId_idx").on(t.userId),
}));

export const copyTrades = mysqlTable("copy_trades", {
  id: int("id").autoincrement().primaryKey(),
  followerId: int("followerId").notNull(),
  traderId: int("traderId").notNull(),
  isActive: boolean("isActive").default(true),
  allocatedAmount: decimal("allocatedAmount", { precision: 15, scale: 2 }).default("0.00"),
  totalProfit: decimal("totalProfit", { precision: 15, scale: 2 }).default("0.00"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
}, (t) => ({
  followerIdx: index("copy_trades_followerId_idx").on(t.followerId),
  traderIdx: index("copy_trades_traderId_idx").on(t.traderId),
}));

// Robot Brain - evolutionary learning system
export const robotBrain = mysqlTable("robot_brain", {
  id: int("id").autoincrement().primaryKey(),
  robotId: int("robotId").notNull(),
  userId: int("userId").notNull(),
  maturityLevel: int("maturityLevel").default(1), // 1-10 scale
  assertiveness: decimal("assertiveness", { precision: 5, scale: 2 }).default("0.00"),
  totalDecisions: int("totalDecisions").default(0),
  correctDecisions: int("correctDecisions").default(0),
  mode: mysqlEnum("mode", ["manual", "semi_auto", "auto"]).default("manual").notNull(),
  autoThreshold: decimal("autoThreshold", { precision: 5, scale: 2 }).default("75.00"), // min assertiveness to enable auto
  learningData: json("learningData"), // patterns learned
  lastDecisionAt: timestamp("lastDecisionAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userRobotIdx: index("robot_brain_userId_robotId_idx").on(t.userId, t.robotId),
}));

// Robot Brain Decisions - history of every decision
export const brainDecisions = mysqlTable("brain_decisions", {
  id: int("id").autoincrement().primaryKey(),
  brainId: int("brainId").notNull(),
  robotId: int("robotId").notNull(),
  userId: int("userId").notNull(),
  decision: mysqlEnum("decision", ["buy", "sell", "hold", "close"]).notNull(),
  asset: varchar("asset", { length: 50 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  reasoning: text("reasoning"),
  outcome: mysqlEnum("outcome", ["profit", "loss", "neutral", "pending"]).default("pending").notNull(),
  profitAmount: decimal("profitAmount", { precision: 15, scale: 2 }),
  executedBy: mysqlEnum("executedBy", ["human", "robot"]).default("human").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userRobotCreatedIdx: index("brain_decisions_userId_robotId_createdAt_idx").on(t.userId, t.robotId, t.createdAt),
}));

// Portfolio Assets - multi-class investment tracking
export const portfolioAssets = mysqlTable("portfolio_assets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  assetClass: mysqlEnum("assetClass", ["acoes", "renda_fixa", "fundos", "cripto", "cdb", "tesouro", "fii", "internacional"]).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  ticker: varchar("ticker", { length: 20 }),
  institution: varchar("institution", { length: 100 }),
  quantity: decimal("quantity", { precision: 15, scale: 6 }).default("0"),
  avgPrice: decimal("avgPrice", { precision: 15, scale: 6 }).default("0"),
  currentPrice: decimal("currentPrice", { precision: 15, scale: 6 }).default("0"),
  totalInvested: decimal("totalInvested", { precision: 15, scale: 2 }).default("0.00"),
  currentValue: decimal("currentValue", { precision: 15, scale: 2 }).default("0.00"),
  profitLoss: decimal("profitLoss", { precision: 15, scale: 2 }).default("0.00"),
  profitPercent: decimal("profitPercent", { precision: 8, scale: 2 }).default("0.00"),
  riskProfile: mysqlEnum("riskProfile", ["conservador", "moderado", "arrojado", "agressivo"]).default("moderado").notNull(),
  horizon: mysqlEnum("horizon", ["curto", "medio", "longo"]).default("medio").notNull(),
  maturityDate: timestamp("maturityDate"),
  yieldRate: decimal("yieldRate", { precision: 8, scale: 4 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("portfolio_assets_userId_idx").on(t.userId),
}));

// Financial Goals - patrimony targets
export const financialGoals = mysqlTable("financial_goals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  targetAmount: decimal("targetAmount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("currentAmount", { precision: 15, scale: 2 }).default("0.00"),
  deadline: timestamp("deadline"),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  category: mysqlEnum("category", ["patrimonio", "renda_passiva", "aposentadoria", "emergencia", "projeto", "outro"]).default("patrimonio").notNull(),
  status: mysqlEnum("status", ["active", "completed", "paused"]).default("active").notNull(),
  monthlyContribution: decimal("monthlyContribution", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userStatusIdx: index("financial_goals_userId_status_idx").on(t.userId, t.status),
}));

// AI Advisor conversations
export const aiConversations = mysqlTable("ai_conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 200 }),
  context: mysqlEnum("context", ["consultor", "auditor", "mercado", "operacao"]).default("consultor").notNull(),
  messages: json("messages"), // array of {role, content, timestamp}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("ai_conversations_userId_idx").on(t.userId),
}));

// Daily P&L tracking
export const dailyPnl = mysqlTable("daily_pnl", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  robotId: int("robotId"),
  date: timestamp("date").notNull(),
  totalTrades: int("totalTrades").default(0),
  winTrades: int("winTrades").default(0),
  lossTrades: int("lossTrades").default(0),
  grossProfit: decimal("grossProfit", { precision: 15, scale: 2 }).default("0.00"),
  grossLoss: decimal("grossLoss", { precision: 15, scale: 2 }).default("0.00"),
  netProfit: decimal("netProfit", { precision: 15, scale: 2 }).default("0.00"),
  fees: decimal("fees", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userDateIdx: index("daily_pnl_userId_date_idx").on(t.userId, t.date),
  userRobotIdx: index("daily_pnl_userId_robotId_idx").on(t.userId, t.robotId),
}));

// Broker Connections
export const brokerConnections = mysqlTable("broker_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  broker: varchar("broker", { length: 50 }).notNull(),
  status: mysqlEnum("status", ["connected", "disconnected", "error", "syncing"]).default("connected").notNull(),
  credentials: text("credentials"), // encrypted JSON
  accountId: varchar("accountId", { length: 100 }),
  lastSync: timestamp("lastSync"),
  syncData: json("syncData"), // last sync results
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  userIdx: index("broker_connections_userId_idx").on(t.userId),
}));

// Watchlist — assets the user/robots monitor for trend opportunities.
export const watchlist = mysqlTable("watchlist", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  label: varchar("label", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("watchlist_userId_idx").on(t.userId),
  userSymbol: uniqueIndex("watchlist_userId_symbol_unique").on(t.userId, t.symbol),
}));

// App-wide settings (admin-managed). Sensitive values are stored encrypted.
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// AI advisor recommendations history. One row per advice request, scoped to
// the user. Links optionally to a brain_decisions row when the advice was
// requested from the /signals view, so we can later cross-reference the
// recommendation with the actual outcome.
export const signalAdvice = mysqlTable("signal_advice", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  decisionId: int("decisionId"),
  home: varchar("home", { length: 100 }).notNull(),
  away: varchar("away", { length: 100 }).notNull(),
  market: varchar("market", { length: 60 }).notNull(),
  outcome: varchar("outcome", { length: 100 }).notNull(),
  bestBook: varchar("bestBook", { length: 100 }),
  bestPrice: decimal("bestPrice", { precision: 8, scale: 3 }),
  avgPrice: decimal("avgPrice", { precision: 8, scale: 3 }),
  edgePct: decimal("edgePct", { precision: 6, scale: 2 }),
  commence: timestamp("commence"),
  prompt: text("prompt").notNull(),
  advice: text("advice").notNull(),
  decision: varchar("decision", { length: 20 }),
  recommendedStakeBrl: decimal("recommendedStakeBrl", { precision: 15, scale: 2 }),
  model: varchar("model", { length: 80 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  userIdx: index("signal_advice_userId_createdAt_idx").on(t.userId, t.createdAt),
  decisionIdx: index("signal_advice_decisionId_idx").on(t.decisionId),
}));

// Persistent cache of api-football team resolutions. National team names
// don't change so we keep these forever to save quota.
export const teamCache = mysqlTable("team_cache", {
  id: int("id").autoincrement().primaryKey(),
  query: varchar("query", { length: 100 }).notNull().unique(),
  teamId: int("teamId").notNull(),
  teamName: varchar("teamName", { length: 120 }).notNull(),
  logo: text("logo"),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Robot = typeof robots.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Backtest = typeof backtests.$inferSelect;
export type RiskSetting = typeof riskSettings.$inferSelect;
export type MarketplaceListing = typeof marketplaceListings.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type CopyTrade = typeof copyTrades.$inferSelect;
export type RobotBrain = typeof robotBrain.$inferSelect;
export type BrainDecision = typeof brainDecisions.$inferSelect;
export type PortfolioAsset = typeof portfolioAssets.$inferSelect;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type DailyPnl = typeof dailyPnl.$inferSelect;
export type SignalAdvice = typeof signalAdvice.$inferSelect;
export type TeamCache = typeof teamCache.$inferSelect;
