-- CreateTable
CREATE TABLE `digital_product_cf_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `cf_product_id` VARCHAR(191) NOT NULL,
    `cf_product_name` VARCHAR(191) NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `upsell_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `digital_product_cf_mappings_cf_product_id_key`(`cf_product_id`),
    INDEX `digital_product_cf_mappings_product_id_idx`(`product_id`),
    INDEX `digital_product_cf_mappings_upsell_id_idx`(`upsell_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `digital_product_subscription_attributions` (
    `id` VARCHAR(191) NOT NULL,
    `cf_subscription_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `upsell_id` VARCHAR(191) NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `click_id` VARCHAR(191) NULL,
    `sub_id` VARCHAR(191) NULL,
    `src` VARCHAR(191) NULL,
    `affiliate_ref` VARCHAR(191) NULL,
    `original_order_id` VARCHAR(191) NULL,
    `original_webhook_event_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `digital_product_subscription_attributions_cf_subscription_id_key`(`cf_subscription_id`),
    INDEX `digital_product_subscription_attributions_product_id_idx`(`product_id`),
    INDEX `digital_product_subscription_attributions_publisher_id_idx`(`publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `external_event_key` VARCHAR(191) NULL,
    ADD COLUMN `cf_product_id` VARCHAR(191) NULL,
    ADD COLUMN `cf_order_id` VARCHAR(191) NULL,
    ADD COLUMN `cf_subscription_id` VARCHAR(191) NULL,
    ADD COLUMN `is_recurring` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `webhook_events_external_event_key_key` ON `webhook_events`(`external_event_key`);

-- AddForeignKey
ALTER TABLE `digital_product_cf_mappings` ADD CONSTRAINT `digital_product_cf_mappings_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `digital_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_product_cf_mappings` ADD CONSTRAINT `digital_product_cf_mappings_upsell_id_fkey` FOREIGN KEY (`upsell_id`) REFERENCES `digital_product_upsells`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_product_subscription_attributions` ADD CONSTRAINT `digital_product_subscription_attributions_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `digital_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_product_subscription_attributions` ADD CONSTRAINT `digital_product_subscription_attributions_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
