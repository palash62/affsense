-- CreateTable
CREATE TABLE `publisher_postbacks` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `type` ENUM('S2S', 'IMAGE', 'HTML') NOT NULL DEFAULT 'S2S',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'INACTIVE',
    `endpoint` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `publisher_postbacks_publisher_id_key`(`publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `publisher_postback_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `lead_id` VARCHAR(191) NULL,
    `postback_id` VARCHAR(191) NULL,
    `url` TEXT NOT NULL,
    `event` ENUM('PAID', 'TEST') NOT NULL DEFAULT 'PAID',
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `http_status` INTEGER NULL,
    `error` TEXT NULL,
    `payout` DECIMAL(10, 4) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `publisher_postback_deliveries_lead_id_key`(`lead_id`),
    INDEX `publisher_postback_deliveries_publisher_id_created_at_idx`(`publisher_id`, `created_at`),
    INDEX `publisher_postback_deliveries_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `publisher_postbacks` ADD CONSTRAINT `publisher_postbacks_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publisher_postback_deliveries` ADD CONSTRAINT `publisher_postback_deliveries_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publisher_postback_deliveries` ADD CONSTRAINT `publisher_postback_deliveries_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `publisher_postback_deliveries` ADD CONSTRAINT `publisher_postback_deliveries_postback_id_fkey` FOREIGN KEY (`postback_id`) REFERENCES `publisher_postbacks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
