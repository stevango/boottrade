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
ALTER TABLE `users` ADD `plan` enum('starter','pro','institutional') DEFAULT 'starter' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `balance` decimal(15,2) DEFAULT '10000.00';--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;