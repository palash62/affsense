-- CreateTable
CREATE TABLE `email_broadcasts` (
    `id` VARCHAR(191) NOT NULL,
    `advertiser_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `template_id` VARCHAR(191) NOT NULL,
    `audience_type` ENUM('LIST', 'TAGS') NOT NULL,
    `list_id` VARCHAR(191) NULL,
    `tag_ids` JSON NULL,
    `status` ENUM('DRAFT', 'QUEUED', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `recipient_count` INTEGER NOT NULL DEFAULT 0,
    `sent_count` INTEGER NOT NULL DEFAULT 0,
    `failed_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_broadcasts_advertiser_id_idx`(`advertiser_id`),
    INDEX `email_broadcasts_advertiser_id_status_idx`(`advertiser_id`, `status`),
    INDEX `email_broadcasts_list_id_idx`(`list_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `email_sends` ADD COLUMN `broadcast_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `email_sends_broadcast_id_idx` ON `email_sends`(`broadcast_id`);

-- AddForeignKey
ALTER TABLE `email_broadcasts` ADD CONSTRAINT `email_broadcasts_advertiser_id_fkey` FOREIGN KEY (`advertiser_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_broadcasts` ADD CONSTRAINT `email_broadcasts_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `email_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_broadcasts` ADD CONSTRAINT `email_broadcasts_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `email_lists`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_sends` ADD CONSTRAINT `email_sends_broadcast_id_fkey` FOREIGN KEY (`broadcast_id`) REFERENCES `email_broadcasts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
