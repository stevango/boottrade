CREATE TABLE `signal_advice` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`decisionId` int,
	`home` varchar(100) NOT NULL,
	`away` varchar(100) NOT NULL,
	`market` varchar(60) NOT NULL,
	`outcome` varchar(100) NOT NULL,
	`bestBook` varchar(100),
	`bestPrice` decimal(8,3),
	`avgPrice` decimal(8,3),
	`edgePct` decimal(6,2),
	`commence` timestamp,
	`prompt` text NOT NULL,
	`advice` text NOT NULL,
	`model` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_advice_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `signal_advice_userId_createdAt_idx` ON `signal_advice` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `signal_advice_decisionId_idx` ON `signal_advice` (`decisionId`);