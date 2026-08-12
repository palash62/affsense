-- Promotion campaigns and advertiser signup UTM attribution
CREATE TABLE `promotions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `utm_source` VARCHAR(191) NOT NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NOT NULL,
    `utm_content` VARCHAR(191) NULL,
    `utm_term` VARCHAR(191) NULL,
    `landing_path` VARCHAR(191) NOT NULL DEFAULT '/',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `promotions_utm_source_utm_medium_utm_campaign_idx`(`utm_source`, `utm_medium`, `utm_campaign`),
    INDEX `promotions_is_active_created_at_idx`(`is_active`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `users` ADD COLUMN `signup_utm_source` VARCHAR(191) NULL,
    ADD COLUMN `signup_utm_medium` VARCHAR(191) NULL,
    ADD COLUMN `signup_utm_campaign` VARCHAR(191) NULL,
    ADD COLUMN `signup_utm_content` VARCHAR(191) NULL,
    ADD COLUMN `signup_utm_term` VARCHAR(191) NULL,
    ADD COLUMN `signup_landing_url` TEXT NULL,
    ADD COLUMN `promotion_id` VARCHAR(191) NULL;

CREATE INDEX `users_promotion_id_idx` ON `users`(`promotion_id`);
CREATE INDEX `users_signup_utm_source_signup_utm_medium_signup_utm_campaign_idx` ON `users`(`signup_utm_source`, `signup_utm_medium`, `signup_utm_campaign`);

ALTER TABLE `promotions` ADD CONSTRAINT `promotions_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `users_promotion_id_fkey` FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
