-- Create join table for multi-campaign email lists
CREATE TABLE `email_list_campaigns` (
    `list_id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,

    INDEX `email_list_campaigns_list_id_idx`(`list_id`),
    UNIQUE INDEX `email_list_campaigns_campaign_id_key`(`campaign_id`),
    PRIMARY KEY (`list_id`, `campaign_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing list ↔ campaign links
INSERT INTO `email_list_campaigns` (`list_id`, `campaign_id`)
SELECT `id`, `campaign_id` FROM `email_lists`;

-- Add list_id to automations (before backfill)
ALTER TABLE `email_automations` ADD COLUMN `list_id` VARCHAR(191) NULL;
CREATE INDEX `email_automations_list_id_idx` ON `email_automations`(`list_id`);

-- Backfill automation list_id from matching list/campaign
UPDATE `email_automations` ea
INNER JOIN `email_lists` el ON el.`campaign_id` = ea.`campaign_id` AND el.`advertiser_id` = ea.`advertiser_id`
SET ea.`list_id` = el.`id`
WHERE ea.`campaign_id` IS NOT NULL AND ea.`list_id` IS NULL;

-- Drop legacy 1:1 column and constraint
ALTER TABLE `email_lists` DROP FOREIGN KEY `email_lists_campaign_id_fkey`;
DROP INDEX `email_lists_advertiser_id_campaign_id_key` ON `email_lists`;
ALTER TABLE `email_lists` DROP COLUMN `campaign_id`;

-- Foreign keys
ALTER TABLE `email_automations` ADD CONSTRAINT `email_automations_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `email_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `email_list_campaigns` ADD CONSTRAINT `email_list_campaigns_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `email_lists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `email_list_campaigns` ADD CONSTRAINT `email_list_campaigns_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
