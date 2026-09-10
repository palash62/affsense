-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `click_id` VARCHAR(191) NULL,
    ADD COLUMN `sub_id` VARCHAR(191) NULL,
    ADD COLUMN `src` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `webhook_events_click_id_idx` ON `webhook_events`(`click_id`);

-- AddForeignKey
ALTER TABLE `webhook_events` ADD CONSTRAINT `webhook_events_click_id_fkey` FOREIGN KEY (`click_id`) REFERENCES `digital_product_clicks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
