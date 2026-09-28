-- CreateTable
CREATE TABLE `cpa_offer_commission_plans` (
    `id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `payout` DECIMAL(10, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cpa_offer_commission_plans_offer_id_idx`(`offer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cpa_offer_commission_plan_members` (
    `id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `cpa_offer_commission_plan_members_offer_id_publisher_id_key`(`offer_id`, `publisher_id`),
    INDEX `cpa_offer_commission_plan_members_plan_id_idx`(`plan_id`),
    INDEX `cpa_offer_commission_plan_members_publisher_id_idx`(`publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_product_commission_plans` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `front_end_commission` DECIMAL(5, 2) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `digital_product_commission_plans_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_product_commission_plan_upsells` (
    `id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `upsell_id` VARCHAR(191) NOT NULL,
    `commission_pct` DECIMAL(5, 2) NOT NULL,

    UNIQUE INDEX `digital_product_commission_plan_upsells_plan_id_upsell_id_key`(`plan_id`, `upsell_id`),
    INDEX `digital_product_commission_plan_upsells_upsell_id_idx`(`upsell_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_product_commission_plan_members` (
    `id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `dp_commission_plan_members_product_publisher_key`(`product_id`, `publisher_id`),
    INDEX `digital_product_commission_plan_members_plan_id_idx`(`plan_id`),
    INDEX `digital_product_commission_plan_members_publisher_id_idx`(`publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `digital_product_id` VARCHAR(191) NULL,
    ADD COLUMN `sale_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `commission_rate` DECIMAL(5, 2) NULL,
    ADD COLUMN `commission_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `digital_commission_plan_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `cpa_offer_commission_plans` ADD CONSTRAINT `cpa_offer_commission_plans_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `cpa_offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cpa_offer_commission_plan_members` ADD CONSTRAINT `cpa_offer_commission_plan_members_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `cpa_offer_commission_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cpa_offer_commission_plan_members` ADD CONSTRAINT `cpa_offer_commission_plan_members_offer_id_fkey` FOREIGN KEY (`offer_id`) REFERENCES `cpa_offers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `cpa_offer_commission_plan_members` ADD CONSTRAINT `cpa_offer_commission_plan_members_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plans` ADD CONSTRAINT `digital_product_commission_plans_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `digital_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plan_upsells` ADD CONSTRAINT `digital_product_commission_plan_upsells_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `digital_product_commission_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plan_upsells` ADD CONSTRAINT `digital_product_commission_plan_upsells_upsell_id_fkey` FOREIGN KEY (`upsell_id`) REFERENCES `digital_product_upsells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plan_members` ADD CONSTRAINT `digital_product_commission_plan_members_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `digital_product_commission_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plan_members` ADD CONSTRAINT `digital_product_commission_plan_members_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `digital_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `digital_product_commission_plan_members` ADD CONSTRAINT `digital_product_commission_plan_members_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
