-- AlterTable
ALTER TABLE `digital_products` ADD COLUMN `lifetime_cookie` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `webhook_events_digital_product_id_lead_email_idx` ON `webhook_events`(`digital_product_id`, `lead_email`);
