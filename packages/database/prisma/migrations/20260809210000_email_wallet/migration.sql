-- CreateTable
CREATE TABLE `email_wallets` (
    `id` VARCHAR(191) NOT NULL,
    `advertiser_id` VARCHAR(191) NOT NULL,
    `balance` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_wallets_advertiser_id_key`(`advertiser_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_wallet_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `wallet_id` VARCHAR(191) NOT NULL,
    `type` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `amount` DECIMAL(12, 4) NOT NULL,
    `balance_after` DECIMAL(12, 4) NOT NULL,
    `reference_type` VARCHAR(191) NOT NULL,
    `reference_id` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_wallet_ledger_wallet_id_created_at_idx`(`wallet_id`, `created_at`),
    INDEX `email_wallet_ledger_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `email_wallets` ADD CONSTRAINT `email_wallets_advertiser_id_fkey` FOREIGN KEY (`advertiser_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_wallet_ledger` ADD CONSTRAINT `email_wallet_ledger_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `email_wallets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
