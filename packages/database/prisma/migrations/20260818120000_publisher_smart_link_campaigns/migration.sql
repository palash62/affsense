-- AlterTable
ALTER TABLE `publisher_profiles` ADD COLUMN `restrict_smart_link_campaigns` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `publisher_smart_link_campaigns` (
    `publisher_id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,

    INDEX `publisher_smart_link_campaigns_campaign_id_idx`(`campaign_id`),
    PRIMARY KEY (`publisher_id`, `campaign_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `publisher_smart_link_campaigns` ADD CONSTRAINT `publisher_smart_link_campaigns_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publisher_smart_link_campaigns` ADD CONSTRAINT `publisher_smart_link_campaigns_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
