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
