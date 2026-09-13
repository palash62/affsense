-- AlterTable
ALTER TABLE `cpa_offer_conversions` ADD COLUMN `advertiser_invoice_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `advertiser_cpa_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `advertiser_id` VARCHAR(191) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `period_key` VARCHAR(191) NULL,
    `issued_at` DATETIME(3) NOT NULL,
    `due_at` DATETIME(3) NOT NULL,
    `subtotal` DECIMAL(12, 4) NOT NULL,
    `total` DECIMAL(12, 4) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `status` ENUM('UNPAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'UNPAID',
    `paid_at` DATETIME(3) NULL,
    `payment_method` ENUM('WISE', 'BANK_TRANSFER', 'STRIPE_CONNECT', 'PAYPAL') NULL,
    `payment_reference` VARCHAR(191) NULL,
    `admin_note` TEXT NULL,
    `cancel_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `advertiser_cpa_invoices_number_key`(`number`),
    INDEX `advertiser_cpa_invoices_status_due_at_idx`(`status`, `due_at`),
    INDEX `advertiser_cpa_invoices_advertiser_id_issued_at_idx`(`advertiser_id`, `issued_at`),
    INDEX `advertiser_cpa_invoices_issued_at_idx`(`issued_at`),
    UNIQUE INDEX `advertiser_cpa_invoices_advertiser_id_period_key_key`(`advertiser_id`, `period_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `advertiser_cpa_invoice_lines` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `offer_id` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `conversion_count` INTEGER NOT NULL,
    `amount` DECIMAL(12, 4) NOT NULL,

    INDEX `advertiser_cpa_invoice_lines_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cpa_offer_conversions_advertiser_invoice_id_idx` ON `cpa_offer_conversions`(`advertiser_invoice_id`);

-- AddForeignKey
ALTER TABLE `cpa_offer_conversions` ADD CONSTRAINT `cpa_offer_conversions_advertiser_invoice_id_fkey` FOREIGN KEY (`advertiser_invoice_id`) REFERENCES `advertiser_cpa_invoices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `advertiser_cpa_invoices` ADD CONSTRAINT `advertiser_cpa_invoices_advertiser_id_fkey` FOREIGN KEY (`advertiser_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `advertiser_cpa_invoice_lines` ADD CONSTRAINT `advertiser_cpa_invoice_lines_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `advertiser_cpa_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
