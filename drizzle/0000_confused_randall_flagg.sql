CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200),
	`context` enum('consultor','auditor','mercado','operacao') NOT NULL DEFAULT 'consultor',
	`messages` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backtests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`robotId` int,
	`name` varchar(200) NOT NULL,
	`market` enum('dolar','acoes','daytrade','cripto','apostas','forex','indices') NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`initialCapital` decimal(15,2) NOT NULL,
	`finalCapital` decimal(15,2),
	`totalReturn` decimal(10,2),
	`maxDrawdown` decimal(5,2),
	`winRate` decimal(5,2),
	`profitFactor` decimal(5,2),
	`totalTrades` int,
	`sharpeRatio` decimal(5,2),
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`results` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brain_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brainId` int NOT NULL,
	`robotId` int NOT NULL,
	`userId` int NOT NULL,
	`decision` enum('buy','sell','hold','close') NOT NULL,
	`asset` varchar(50) NOT NULL,
	`confidence` decimal(5,2) NOT NULL,
	`reasoning` text,
	`outcome` enum('profit','loss','neutral','pending') NOT NULL DEFAULT 'pending',
	`profitAmount` decimal(15,2),
	`executedBy` enum('human','robot') NOT NULL DEFAULT 'human',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `brain_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `broker_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`broker` varchar(50) NOT NULL,
	`status` enum('connected','disconnected','error','syncing') NOT NULL DEFAULT 'connected',
	`credentials` text,
	`accountId` varchar(100),
	`lastSync` timestamp,
	`syncData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `broker_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `copy_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`followerId` int NOT NULL,
	`traderId` int NOT NULL,
	`isActive` boolean DEFAULT true,
	`allocatedAmount` decimal(15,2) DEFAULT '0.00',
	`totalProfit` decimal(15,2) DEFAULT '0.00',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `copy_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `daily_pnl` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`robotId` int,
	`date` timestamp NOT NULL,
	`totalTrades` int DEFAULT 0,
	`winTrades` int DEFAULT 0,
	`lossTrades` int DEFAULT 0,
	`grossProfit` decimal(15,2) DEFAULT '0.00',
	`grossLoss` decimal(15,2) DEFAULT '0.00',
	`netProfit` decimal(15,2) DEFAULT '0.00',
	`fees` decimal(10,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_pnl_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`targetAmount` decimal(15,2) NOT NULL,
	`currentAmount` decimal(15,2) DEFAULT '0.00',
	`deadline` timestamp,
	`priority` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`category` enum('patrimonio','renda_passiva','aposentadoria','emergencia','projeto','outro') NOT NULL DEFAULT 'patrimonio',
	`status` enum('active','completed','paused') NOT NULL DEFAULT 'active',
	`monthlyContribution` decimal(10,2) DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketplace_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`robotId` int NOT NULL,
	`sellerId` int NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text,
	`price` decimal(10,2) NOT NULL,
	`subscriptionType` enum('monthly','yearly','lifetime') NOT NULL DEFAULT 'monthly',
	`rating` decimal(3,2) DEFAULT '0.00',
	`totalReviews` int DEFAULT 0,
	`totalSubscribers` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketplace_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetClass` enum('acoes','renda_fixa','fundos','cripto','cdb','tesouro','fii','internacional') NOT NULL,
	`name` varchar(200) NOT NULL,
	`ticker` varchar(20),
	`institution` varchar(100),
	`quantity` decimal(15,6) DEFAULT '0',
	`avgPrice` decimal(15,6) DEFAULT '0',
	`currentPrice` decimal(15,6) DEFAULT '0',
	`totalInvested` decimal(15,2) DEFAULT '0.00',
	`currentValue` decimal(15,2) DEFAULT '0.00',
	`profitLoss` decimal(15,2) DEFAULT '0.00',
	`profitPercent` decimal(8,2) DEFAULT '0.00',
	`riskProfile` enum('conservador','moderado','arrojado','agressivo') NOT NULL DEFAULT 'moderado',
	`horizon` enum('curto','medio','longo') NOT NULL DEFAULT 'medio',
	`maturityDate` timestamp,
	`yieldRate` decimal(8,4),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `portfolio_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`maxDailyLoss` decimal(10,2) DEFAULT '500.00',
	`maxDrawdown` decimal(5,2) DEFAULT '10.00',
	`defaultStopLoss` decimal(5,2) DEFAULT '2.00',
	`defaultTakeProfit` decimal(5,2) DEFAULT '4.00',
	`maxOpenPositions` int DEFAULT 5,
	`maxLeverage` decimal(5,2) DEFAULT '10.00',
	`autoStopEnabled` boolean DEFAULT true,
	`alertsEnabled` boolean DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risk_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `robot_brain` (
	`id` int AUTO_INCREMENT NOT NULL,
	`robotId` int NOT NULL,
	`userId` int NOT NULL,
	`maturityLevel` int DEFAULT 1,
	`assertiveness` decimal(5,2) DEFAULT '0.00',
	`totalDecisions` int DEFAULT 0,
	`correctDecisions` int DEFAULT 0,
	`mode` enum('manual','semi_auto','auto') NOT NULL DEFAULT 'manual',
	`autoThreshold` decimal(5,2) DEFAULT '75.00',
	`learningData` json,
	`lastDecisionAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `robot_brain_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `robots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`market` enum('dolar','acoes','daytrade','cripto','apostas','forex','indices') NOT NULL,
	`strategy` text,
	`status` enum('active','paused','testing','archived') NOT NULL DEFAULT 'paused',
	`riskLevel` enum('low','medium','high','extreme') NOT NULL DEFAULT 'medium',
	`winRate` decimal(5,2) DEFAULT '0.00',
	`totalReturn` decimal(10,2) DEFAULT '0.00',
	`drawdown` decimal(5,2) DEFAULT '0.00',
	`profitFactor` decimal(5,2) DEFAULT '0.00',
	`totalTrades` int DEFAULT 0,
	`monthlyReturn` decimal(8,2) DEFAULT '0.00',
	`iaScore` decimal(4,1) DEFAULT '0.0',
	`config` json,
	`isPublic` boolean DEFAULT false,
	`price` decimal(10,2) DEFAULT '0.00',
	`subscribers` int DEFAULT 0,
	`creatorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `robots_id` PRIMARY KEY(`id`),
	CONSTRAINT `robots_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`tradeId` int,
	`likes` int DEFAULT 0,
	`comments` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`robotId` int,
	`type` enum('buy','sell') NOT NULL,
	`asset` varchar(50) NOT NULL,
	`market` enum('dolar','acoes','daytrade','cripto','apostas','forex','indices') NOT NULL,
	`entryPrice` decimal(15,6) NOT NULL,
	`exitPrice` decimal(15,6),
	`quantity` decimal(15,6) NOT NULL,
	`profit` decimal(15,2),
	`status` enum('open','closed','cancelled') NOT NULL DEFAULT 'open',
	`isPaperTrade` boolean DEFAULT false,
	`stopLoss` decimal(15,6),
	`takeProfit` decimal(15,6),
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_robots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`robotId` int NOT NULL,
	`status` enum('active','paused','stopped') NOT NULL DEFAULT 'active',
	`investedAmount` decimal(15,2) DEFAULT '0.00',
	`currentReturn` decimal(15,2) DEFAULT '0.00',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`stoppedAt` timestamp,
	CONSTRAINT `user_robots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`plan` enum('starter','pro','institutional') NOT NULL DEFAULT 'starter',
	`balance` decimal(15,2) DEFAULT '10000.00',
	`avatarUrl` text,
	`bio` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `ai_conversations_userId_idx` ON `ai_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `backtests_userId_createdAt_idx` ON `backtests` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `brain_decisions_userId_robotId_createdAt_idx` ON `brain_decisions` (`userId`,`robotId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `broker_connections_userId_idx` ON `broker_connections` (`userId`);--> statement-breakpoint
CREATE INDEX `copy_trades_followerId_idx` ON `copy_trades` (`followerId`);--> statement-breakpoint
CREATE INDEX `copy_trades_traderId_idx` ON `copy_trades` (`traderId`);--> statement-breakpoint
CREATE INDEX `daily_pnl_userId_date_idx` ON `daily_pnl` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `daily_pnl_userId_robotId_idx` ON `daily_pnl` (`userId`,`robotId`);--> statement-breakpoint
CREATE INDEX `financial_goals_userId_status_idx` ON `financial_goals` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `marketplace_listings_isActive_idx` ON `marketplace_listings` (`isActive`);--> statement-breakpoint
CREATE INDEX `marketplace_listings_robotId_idx` ON `marketplace_listings` (`robotId`);--> statement-breakpoint
CREATE INDEX `portfolio_assets_userId_idx` ON `portfolio_assets` (`userId`);--> statement-breakpoint
CREATE INDEX `risk_settings_userId_idx` ON `risk_settings` (`userId`);--> statement-breakpoint
CREATE INDEX `robot_brain_userId_robotId_idx` ON `robot_brain` (`userId`,`robotId`);--> statement-breakpoint
CREATE INDEX `robots_market_idx` ON `robots` (`market`);--> statement-breakpoint
CREATE INDEX `robots_iaScore_idx` ON `robots` (`iaScore`);--> statement-breakpoint
CREATE INDEX `social_posts_createdAt_idx` ON `social_posts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `social_posts_userId_idx` ON `social_posts` (`userId`);--> statement-breakpoint
CREATE INDEX `trades_userId_openedAt_idx` ON `trades` (`userId`,`openedAt`);--> statement-breakpoint
CREATE INDEX `user_robots_userId_idx` ON `user_robots` (`userId`);--> statement-breakpoint
CREATE INDEX `user_robots_robotId_idx` ON `user_robots` (`robotId`);