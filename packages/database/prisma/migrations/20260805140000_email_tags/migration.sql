-- CreateTable
CREATE TABLE `email_tags` (
    `id` VARCHAR(191) NOT NULL,
    `advertiser_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_tags_advertiser_id_idx`(`advertiser_id`),
    UNIQUE INDEX `email_tags_advertiser_id_name_key`(`advertiser_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_contact_tags` (
    `contact_id` VARCHAR(191) NOT NULL,
    `tag_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_contact_tags_tag_id_idx`(`tag_id`),
    PRIMARY KEY (`contact_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_tags` ADD CONSTRAINT `email_tags_advertiser_id_fkey` FOREIGN KEY (`advertiser_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_contact_tags` ADD CONSTRAINT `email_contact_tags_contact_id_fkey` FOREIGN KEY (`contact_id`) REFERENCES `email_contacts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_contact_tags` ADD CONSTRAINT `email_contact_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `email_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
