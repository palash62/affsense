-- CreateEnum
CREATE TABLE `promotion_events` (
    `id` VARCHAR(191) NOT NULL,
    `promotion_id` VARCHAR(191) NULL,
    `event_type` ENUM('CLICK', 'VISIT') NOT NULL,
    `utm_source` VARCHAR(191) NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `utm_content` VARCHAR(191) NULL,
    `utm_term` VARCHAR(191) NULL,
    `landing_path` VARCHAR(191) NULL,
    `landing_url` TEXT NULL,
    `ip` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `referrer` TEXT NULL,
    `visitor_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `promotion_events_promotion_id_event_type_created_at_idx`(`promotion_id`, `event_type`, `created_at`),
    INDEX `promotion_events_event_type_created_at_idx`(`event_type`, `created_at`),
    INDEX `promotion_events_utm_source_utm_medium_utm_campaign_idx`(`utm_source`, `utm_medium`, `utm_campaign`),
    INDEX `promotion_events_visitor_key_promotion_id_event_type_created_at_idx`(`visitor_key`, `promotion_id`, `event_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `promotion_events` ADD CONSTRAINT `promotion_events_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
