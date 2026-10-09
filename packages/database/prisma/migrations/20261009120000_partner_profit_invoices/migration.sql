-- Monthly 20% partner profit invoices replace the free-form partner payment log.
DROP TABLE IF EXISTS `partner_payments`;

CREATE TABLE `partner_profit_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `period_month` VARCHAR(191) NOT NULL,
    `period_start` DATETIME(3) NOT NULL,
    `period_end` DATETIME(3) NOT NULL,
    `received` DECIMAL(12, 4) NOT NULL,
    `affiliate_sent` DECIMAL(12, 4) NOT NULL,
    `referral_sent` DECIMAL(12, 4) NOT NULL,
    `platform_profit` DECIMAL(12, 4) NOT NULL,
    `amount` DECIMAL(12, 4) NOT NULL,
    `status` ENUM('UNPAID', 'PAID', 'NOTHING_DUE') NOT NULL DEFAULT 'UNPAID',
    `issued_at` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `payment_method` VARCHAR(60) NULL,
    `payment_reference` VARCHAR(191) NULL,
    `paid_note` TEXT NULL,
    `paid_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `partner_profit_invoices_number_key`(`number`),
    UNIQUE INDEX `partner_profit_invoices_period_month_key`(`period_month`),
    INDEX `partner_profit_invoices_status_idx`(`status`),
    INDEX `partner_profit_invoices_paid_by_id_idx`(`paid_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `partner_profit_invoices` ADD CONSTRAINT `partner_profit_invoices_paid_by_id_fkey` FOREIGN KEY (`paid_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
