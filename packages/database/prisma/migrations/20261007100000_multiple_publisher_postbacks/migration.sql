-- Publishers can now have any number of Digital Product and CPA postbacks.

-- publisher_postbacks: optional label, no longer one row per channel.
ALTER TABLE `publisher_postbacks` ADD COLUMN `name` VARCHAR(100) NULL;
CREATE INDEX `publisher_postbacks_publisher_id_channel_idx` ON `publisher_postbacks`(`publisher_id`, `channel`);
DROP INDEX `publisher_postbacks_publisher_id_channel_key` ON `publisher_postbacks`;

-- digital_product_postback_deliveries: one row per (webhook event, postback).
UPDATE `digital_product_postback_deliveries` d
LEFT JOIN `publisher_postbacks` p
  ON p.`publisher_id` = d.`publisher_id` AND p.`channel` = 'DIGITAL_PRODUCT'
SET d.`postback_id` = COALESCE(p.`id`, 'legacy')
WHERE d.`postback_id` IS NULL;

ALTER TABLE `digital_product_postback_deliveries` MODIFY `postback_id` VARCHAR(191) NOT NULL;
CREATE INDEX `digital_product_postback_deliveries_webhook_event_id_idx` ON `digital_product_postback_deliveries`(`webhook_event_id`);
CREATE UNIQUE INDEX `digital_product_postback_deliveries_webhook_event_id_postbac_key` ON `digital_product_postback_deliveries`(`webhook_event_id`, `postback_id`);
DROP INDEX `digital_product_postback_deliveries_webhook_event_id_key` ON `digital_product_postback_deliveries`;

-- cpa_postback_deliveries: PUBLISHER rows are keyed per postback; admin/advertiser rows keep ''.
ALTER TABLE `cpa_postback_deliveries` ADD COLUMN `postback_id` VARCHAR(191) NOT NULL DEFAULT '';

UPDATE `cpa_postback_deliveries` d
JOIN `cpa_offer_conversions` conv ON conv.`id` = d.`conversion_id`
JOIN `cpa_offer_clicks` clk ON clk.`id` = conv.`click_record_id`
JOIN `publisher_postbacks` p ON p.`publisher_id` = clk.`publisher_id` AND p.`channel` = 'CPA'
SET d.`postback_id` = p.`id`
WHERE d.`target` = 'PUBLISHER';

CREATE UNIQUE INDEX `cpa_postback_deliveries_conversion_id_target_postback_id_key` ON `cpa_postback_deliveries`(`conversion_id`, `target`, `postback_id`);
DROP INDEX `cpa_postback_deliveries_conversion_id_target_key` ON `cpa_postback_deliveries`;
