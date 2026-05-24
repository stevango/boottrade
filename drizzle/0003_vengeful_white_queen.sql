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
