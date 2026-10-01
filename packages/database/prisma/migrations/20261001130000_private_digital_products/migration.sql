-- AlterTable
ALTER TABLE `cpa_offers` MODIFY `visibility` ENUM('PUBLIC', 'PRIVATE', 'HIDDEN') NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE `digital_products` ADD COLUMN `is_private` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `digital_product_allowed_publishers` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `digital_product_allowed_publishers_publisher_id_idx`(`publisher_id`),
    UNIQUE INDEX `digital_product_allowed_publishers_product_id_publisher_id_key`(`product_id`, `publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `digital_product_allowed_publishers` ADD CONSTRAINT `digital_product_allowed_publishers_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `digital_products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `digital_product_allowed_publishers` ADD CONSTRAINT `digital_product_allowed_publishers_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
