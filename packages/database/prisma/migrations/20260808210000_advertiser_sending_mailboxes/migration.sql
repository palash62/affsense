-- CreateTable
CREATE TABLE `advertiser_sending_mailboxes` (
    `id` VARCHAR(191) NOT NULL,
    `identity_id` VARCHAR(191) NOT NULL,
    `advertiser_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `from_name` VARCHAR(191) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `advertiser_sending_mailboxes_identity_id_email_key`(`identity_id`, `email`),
    UNIQUE INDEX `advertiser_sending_mailboxes_advertiser_id_email_key`(`advertiser_id`, `email`),
    INDEX `advertiser_sending_mailboxes_advertiser_id_idx`(`advertiser_id`),
    INDEX `advertiser_sending_mailboxes_identity_id_idx`(`identity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `advertiser_sending_mailboxes` ADD CONSTRAINT `advertiser_sending_mailboxes_identity_id_fkey` FOREIGN KEY (`identity_id`) REFERENCES `advertiser_sending_identities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `advertiser_sending_mailboxes` ADD CONSTRAINT `advertiser_sending_mailboxes_advertiser_id_fkey` FOREIGN KEY (`advertiser_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one mailbox per existing identity
INSERT INTO `advertiser_sending_mailboxes` (`id`, `identity_id`, `advertiser_id`, `email`, `from_name`, `is_default`, `created_at`, `updated_at`)
SELECT
  CONCAT('mb_', `id`),
  `id`,
  `advertiser_id`,
  LOWER(`from_email`),
  `from_name`,
  true,
  `created_at`,
  `updated_at`
FROM `advertiser_sending_identities`
WHERE `from_email` IS NOT NULL AND `from_email` <> '';
