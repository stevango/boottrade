CREATE TABLE `bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`decisionId` int,
	`adviceId` int,
	`event` varchar(200) NOT NULL,
	`market` varchar(60) NOT NULL,
	`outcome` varchar(100) NOT NULL,
	`side` enum('BACK','LAY') NOT NULL DEFAULT 'BACK',
	`bookmaker` varchar(60) NOT NULL,
	`price` decimal(8,3) NOT NULL,
	`stake` decimal(15,2) NOT NULL,
	`betfairMarketId` varchar(32),
	`betfairSelectionId` varchar(32),
	`betfairBetId` varchar(32),
	`averagePriceMatched` decimal(8,3),
	`sizeMatched` decimal(15,2),
	`status` enum('pending','placed','won','lost','void','cancelled','error') NOT NULL DEFAULT 'pending',
	`profit` decimal(15,2),
	`placedAt` timestamp NOT NULL DEFAULT (now()),
	`settledAt` timestamp,
	`source` enum('manual','betfair_auto','betfair_oneClick') NOT NULL DEFAULT 'manual',
	`errorMessage` text,
	CONSTRAINT `bets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bets_userId_placedAt_idx` ON `bets` (`userId`,`placedAt`);--> statement-breakpoint
CREATE INDEX `bets_decisionId_idx` ON `bets` (`decisionId`);--> statement-breakpoint
CREATE INDEX `bets_betfairBetId_idx` ON `bets` (`betfairBetId`);