-- AlterTable
ALTER TABLE `cpa_offer_clicks` ADD COLUMN `solo_click_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `digital_product_clicks` ADD COLUMN `solo_click_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `attribution_method` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `solo_providers` (
    `id` VARCHAR(191) NOT NULL,
    `public_code` INTEGER NOT NULL,
    `real_name` VARCHAR(191) NOT NULL,
    `contact` TEXT NULL,
    `traffic_class` ENUM('REGULAR', 'WARM', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `status` ENUM('ACTIVE', 'PAUSED', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `geo_rules` JSON NULL,
    `daily_capacity` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solo_providers_public_code_key`(`public_code`),
    INDEX `solo_providers_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_provider_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `traffic_type` ENUM('REGULAR', 'WARM') NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `created_by_id` VARCHAR(191) NULL,
    `revoked_at` DATETIME(3) NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `solo_provider_tokens_token_hash_key`(`token_hash`),
    INDEX `solo_provider_tokens_provider_id_status_idx`(`provider_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_campaigns` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `offer_type` ENUM('CPA', 'DIGITAL') NOT NULL,
    `cpa_offer_id` VARCHAR(191) NULL,
    `digital_product_id` VARCHAR(191) NULL,
    `traffic_type` ENUM('REGULAR', 'WARM') NOT NULL,
    `destination_mode` ENUM('DIRECT', 'EXTERNAL') NOT NULL,
    `destination_url` TEXT NULL,
    `destination_host` VARCHAR(191) NULL,
    `tracking_verified_at` DATETIME(3) NULL,
    `countries` JSON NOT NULL,
    `devices` JSON NULL,
    `active_hours` JSON NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'UTC',
    `start_at` DATETIME(3) NULL,
    `end_at` DATETIME(3) NULL,
    `daily_budget_cents` INTEGER NOT NULL,
    `lifetime_budget_cents` INTEGER NOT NULL,
    `cpc_cents_snapshot` INTEGER NOT NULL,
    `spent_cents` INTEGER NOT NULL DEFAULT 0,
    `reserved_cents` INTEGER NOT NULL DEFAULT 0,
    `paid_clicks` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'BUDGET_EXHAUSTED', 'INSUFFICIENT_FUNDS', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `status_reason` TEXT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `submitted_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `solo_campaigns_publisher_id_status_idx`(`publisher_id`, `status`),
    INDEX `solo_campaigns_status_traffic_type_idx`(`status`, `traffic_type`),
    INDEX `solo_campaigns_destination_host_idx`(`destination_host`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_campaign_provider_blocks` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NOT NULL,
    `blocked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `solo_campaign_provider_blocks_campaign_id_provider_id_key`(`campaign_id`, `provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_daily_usage` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `local_date` VARCHAR(10) NOT NULL,
    `reserved_cents` INTEGER NOT NULL DEFAULT 0,
    `spent_cents` INTEGER NOT NULL DEFAULT 0,
    `paid_clicks` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `solo_daily_usage_campaign_id_local_date_key`(`campaign_id`, `local_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_provider_daily_usage` (
    `id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(10) NOT NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `solo_provider_daily_usage_provider_id_date_key`(`provider_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_clicks` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `token_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NULL,
    `traffic_type` ENUM('REGULAR', 'WARM') NOT NULL,
    `offer_type` ENUM('CPA', 'DIGITAL') NULL,
    `cpa_offer_id` VARCHAR(191) NULL,
    `digital_product_id` VARCHAR(191) NULL,
    `ip_hash` VARCHAR(64) NOT NULL,
    `country` VARCHAR(2) NULL,
    `device` VARCHAR(16) NULL,
    `ua_hash` VARCHAR(64) NULL,
    `target_url` TEXT NULL,
    `billing_status` ENUM('PENDING', 'BILLED', 'INVALID', 'REFUNDED', 'FALLBACK') NOT NULL DEFAULT 'PENDING',
    `invalid_reason` VARCHAR(191) NULL,
    `charge_cents` INTEGER NOT NULL DEFAULT 0,
    `local_date` VARCHAR(10) NULL,
    `finalized_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `solo_clicks_campaign_id_created_at_idx`(`campaign_id`, `created_at`),
    INDEX `solo_clicks_publisher_id_created_at_idx`(`publisher_id`, `created_at`),
    INDEX `solo_clicks_provider_id_created_at_idx`(`provider_id`, `created_at`),
    INDEX `solo_clicks_billing_status_created_at_idx`(`billing_status`, `created_at`),
    INDEX `solo_clicks_ip_hash_created_at_idx`(`ip_hash`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_wallets` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `balance_cents` INTEGER NOT NULL DEFAULT 0,
    `reserved_cents` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solo_wallets_publisher_id_key`(`publisher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_wallet_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `wallet_id` VARCHAR(191) NOT NULL,
    `type` ENUM('DEPOSIT', 'EARNINGS_TRANSFER', 'CHARGE', 'REFUND', 'ADJUSTMENT', 'CHARGEBACK', 'REVERSAL') NOT NULL,
    `amount_cents` INTEGER NOT NULL,
    `balance_after_cents` INTEGER NOT NULL,
    `idempotency_key` VARCHAR(191) NOT NULL,
    `source_type` VARCHAR(191) NULL,
    `source_id` VARCHAR(191) NULL,
    `actor_id` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `solo_wallet_ledger_idempotency_key_key`(`idempotency_key`),
    INDEX `solo_wallet_ledger_wallet_id_created_at_idx`(`wallet_id`, `created_at`),
    INDEX `solo_wallet_ledger_type_created_at_idx`(`type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_deposits` (
    `id` VARCHAR(191) NOT NULL,
    `wallet_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `amount_cents` INTEGER NOT NULL,
    `stripe_payment_intent_id` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'DISPUTED') NOT NULL DEFAULT 'PENDING',
    `failure_reason` TEXT NULL,
    `refunded_cents` INTEGER NOT NULL DEFAULT 0,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solo_deposits_stripe_payment_intent_id_key`(`stripe_payment_intent_id`),
    INDEX `solo_deposits_publisher_id_created_at_idx`(`publisher_id`, `created_at`),
    INDEX `solo_deposits_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_tracking_sites` (
    `id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `site_key` VARCHAR(191) NOT NULL,
    `api_key_hash` VARCHAR(191) NOT NULL,
    `api_key_prefix` VARCHAR(191) NOT NULL,
    `last_seen_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solo_tracking_sites_publisher_id_key`(`publisher_id`),
    UNIQUE INDEX `solo_tracking_sites_site_key_key`(`site_key`),
    UNIQUE INDEX `solo_tracking_sites_api_key_hash_key`(`api_key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_tracking_hosts` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `solo_tracking_hosts_site_id_host_key`(`site_id`, `host`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_lead_events` (
    `id` VARCHAR(191) NOT NULL,
    `event_key` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `solo_click_id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `source` ENUM('SCRIPT', 'API') NOT NULL,
    `email_hash` VARCHAR(64) NULL,
    `status` ENUM('VALID', 'DUPLICATE', 'REJECTED') NOT NULL DEFAULT 'VALID',
    `reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `solo_lead_events_event_key_key`(`event_key`),
    INDEX `solo_lead_events_campaign_id_created_at_idx`(`campaign_id`, `created_at`),
    INDEX `solo_lead_events_campaign_id_email_hash_idx`(`campaign_id`, `email_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_conversions` (
    `id` VARCHAR(191) NOT NULL,
    `solo_click_id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `publisher_id` VARCHAR(191) NOT NULL,
    `source` ENUM('CPA', 'DIGITAL') NOT NULL,
    `dedupe_key` VARCHAR(191) NOT NULL,
    `cpa_offer_conversion_id` VARCHAR(191) NULL,
    `webhook_event_id` VARCHAR(191) NULL,
    `external_txn_id` VARCHAR(191) NULL,
    `commission_cents` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REVERSED') NOT NULL DEFAULT 'PENDING',
    `is_recurring` BOOLEAN NOT NULL DEFAULT false,
    `assisted` BOOLEAN NOT NULL DEFAULT false,
    `reversed_at` DATETIME(3) NULL,
    `reverse_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `solo_conversions_dedupe_key_key`(`dedupe_key`),
    INDEX `solo_conversions_campaign_id_created_at_idx`(`campaign_id`, `created_at`),
    INDEX `solo_conversions_publisher_id_created_at_idx`(`publisher_id`, `created_at`),
    INDEX `solo_conversions_provider_id_created_at_idx`(`provider_id`, `created_at`),
    INDEX `solo_conversions_cpa_offer_conversion_id_idx`(`cpa_offer_conversion_id`),
    INDEX `solo_conversions_webhook_event_id_idx`(`webhook_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solo_daily_stats` (
    `id` VARCHAR(191) NOT NULL,
    `campaign_id` VARCHAR(191) NOT NULL,
    `provider_id` VARCHAR(191) NOT NULL,
    `local_date` VARCHAR(10) NOT NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `billed_clicks` INTEGER NOT NULL DEFAULT 0,
    `invalid_clicks` INTEGER NOT NULL DEFAULT 0,
    `spend_cents` INTEGER NOT NULL DEFAULT 0,
    `leads` INTEGER NOT NULL DEFAULT 0,
    `conversions` INTEGER NOT NULL DEFAULT 0,
    `commission_cents` INTEGER NOT NULL DEFAULT 0,
    `reversed_cents` INTEGER NOT NULL DEFAULT 0,

    INDEX `solo_daily_stats_provider_id_local_date_idx`(`provider_id`, `local_date`),
    UNIQUE INDEX `solo_daily_stats_campaign_id_provider_id_local_date_key`(`campaign_id`, `provider_id`, `local_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `cpa_offer_clicks_solo_click_id_key` ON `cpa_offer_clicks`(`solo_click_id`);

-- CreateIndex
CREATE UNIQUE INDEX `digital_product_clicks_solo_click_id_key` ON `digital_product_clicks`(`solo_click_id`);

-- AddForeignKey
ALTER TABLE `solo_provider_tokens` ADD CONSTRAINT `solo_provider_tokens_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `solo_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_campaigns` ADD CONSTRAINT `solo_campaigns_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_campaigns` ADD CONSTRAINT `solo_campaigns_cpa_offer_id_fkey` FOREIGN KEY (`cpa_offer_id`) REFERENCES `cpa_offers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_campaigns` ADD CONSTRAINT `solo_campaigns_digital_product_id_fkey` FOREIGN KEY (`digital_product_id`) REFERENCES `digital_products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_campaign_provider_blocks` ADD CONSTRAINT `solo_campaign_provider_blocks_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_campaign_provider_blocks` ADD CONSTRAINT `solo_campaign_provider_blocks_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `solo_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_daily_usage` ADD CONSTRAINT `solo_daily_usage_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_provider_daily_usage` ADD CONSTRAINT `solo_provider_daily_usage_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `solo_providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_clicks` ADD CONSTRAINT `solo_clicks_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_wallets` ADD CONSTRAINT `solo_wallets_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_wallet_ledger` ADD CONSTRAINT `solo_wallet_ledger_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `solo_wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_deposits` ADD CONSTRAINT `solo_deposits_wallet_id_fkey` FOREIGN KEY (`wallet_id`) REFERENCES `solo_wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_tracking_sites` ADD CONSTRAINT `solo_tracking_sites_publisher_id_fkey` FOREIGN KEY (`publisher_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_tracking_hosts` ADD CONSTRAINT `solo_tracking_hosts_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `solo_tracking_sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_lead_events` ADD CONSTRAINT `solo_lead_events_solo_click_id_fkey` FOREIGN KEY (`solo_click_id`) REFERENCES `solo_clicks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_lead_events` ADD CONSTRAINT `solo_lead_events_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_conversions` ADD CONSTRAINT `solo_conversions_solo_click_id_fkey` FOREIGN KEY (`solo_click_id`) REFERENCES `solo_clicks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_conversions` ADD CONSTRAINT `solo_conversions_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solo_daily_stats` ADD CONSTRAINT `solo_daily_stats_campaign_id_fkey` FOREIGN KEY (`campaign_id`) REFERENCES `solo_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

