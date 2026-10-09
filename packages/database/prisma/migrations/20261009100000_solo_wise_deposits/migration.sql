-- Solo Ads: manual Wise deposits reviewed by an admin.
ALTER TABLE `solo_deposits`
    MODIFY `status` ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'DISPUTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `method` ENUM('CARD', 'WISE') NOT NULL DEFAULT 'CARD' AFTER `amount_cents`,
    ADD COLUMN `payment_reference` VARCHAR(120) NULL AFTER `stripe_payment_intent_id`,
    ADD COLUMN `note` TEXT NULL AFTER `payment_reference`,
    ADD COLUMN `reviewed_by_id` VARCHAR(191) NULL AFTER `refunded_cents`,
    ADD COLUMN `reviewed_at` DATETIME(3) NULL AFTER `reviewed_by_id`;

CREATE INDEX `solo_deposits_method_status_idx` ON `solo_deposits`(`method`, `status`);
CREATE INDEX `solo_deposits_payment_reference_idx` ON `solo_deposits`(`payment_reference`);
