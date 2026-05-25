CREATE TABLE `watchlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`label` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlist_userId_symbol_unique` UNIQUE(`userId`,`symbol`)
);
--> statement-breakpoint
CREATE INDEX `watchlist_userId_idx` ON `watchlist` (`userId`);