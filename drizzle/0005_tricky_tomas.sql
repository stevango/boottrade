CREATE TABLE `team_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`query` varchar(100) NOT NULL,
	`teamId` int NOT NULL,
	`teamName` varchar(120) NOT NULL,
	`logo` text,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `team_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `team_cache_query_unique` UNIQUE(`query`)
);
--> statement-breakpoint
ALTER TABLE `signal_advice` ADD `decision` varchar(20);--> statement-breakpoint
ALTER TABLE `signal_advice` ADD `recommendedStakeBrl` decimal(15,2);