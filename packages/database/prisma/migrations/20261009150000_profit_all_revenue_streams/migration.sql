-- Platform profit now counts every revenue stream and the Solo Ads provider cost.
ALTER TABLE `partner_profit_invoices`
    ADD COLUMN `solo_provider_cost` DECIMAL(12, 4) NOT NULL DEFAULT 0,
    ADD COLUMN `breakdown` JSON NULL;

ALTER TABLE `solo_campaigns` ADD COLUMN `provider_cost_cents_snapshot` INTEGER NULL;
