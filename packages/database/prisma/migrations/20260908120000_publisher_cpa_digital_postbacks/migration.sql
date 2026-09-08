-- AlterEnum
ALTER TABLE `cpa_postback_deliveries` MODIFY `target` ENUM('ADMIN_PARALLEL', 'ADVERTISER_GLOBAL', 'PUBLISHER') NOT NULL;

-- CreateEnum
-- PublisherPostbackChannel added via column below

-- AlterTable publisher_postbacks: add channel, drop unique on publisher_id alone
ALTER TABLE `publisher_postbacks` ADD COLUMN `channel` ENUM('CPL', 'CPA', 'DIGITAL_PRODUCT') NOT NULL DEFAULT 'CPL';

DROP INDEX `publisher_postbacks_publisher_id_key` ON `publisher_postbacks`;

CREATE UNIQUE INDEX `publisher_postbacks_publisher_id_channel_key` ON `publisher_postbacks`(`publisher_id`, `channel`);

CREATE INDEX `publisher_postbacks_publisher_id_idx` ON `publisher_postbacks`(`publisher_id`);

-- CreateTable
CREATE TABLE `digital_product_postback_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `webhook_event_id` VARCHAR(191) NOT NULL,
    `postback_id` VARCHAR(191) NULL,
    `url` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `http_status` INTEGER NULL,
    `error` TEXT NULL,
    `payout` DECIMAL(10, 2) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `digital_product_postback_deliveries_webhook_event_id_key`(`webhook_event_id`),
    INDEX `digital_product_postback_deliveries_publisher_id_created_at_idx`(`publisher_id`, `created_at`),
    INDEX `digital_product_postback_deliveries_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `digital_product_postback_deliveries` ADD CONSTRAINT `digital_product_postback_deliveries_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_postback_deliveries` ADD CONSTRAINT `digital_product_postback_deliveries_webhook_event_id_fkey` FOREIGN KEY (`webhook_event_id`) REFERENCES `webhook_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
