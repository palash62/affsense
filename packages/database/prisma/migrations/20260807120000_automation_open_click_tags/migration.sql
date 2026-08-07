-- AlterTable
ALTER TABLE `email_automations` ADD COLUMN `open_tag_id` VARCHAR(191) NULL,
    ADD COLUMN `click_tag_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `email_automations_open_tag_id_idx` ON `email_automations`(`open_tag_id`);

-- CreateIndex
CREATE INDEX `email_automations_click_tag_id_idx` ON `email_automations`(`click_tag_id`);

-- AddForeignKey
ALTER TABLE `email_automations` ADD CONSTRAINT `email_automations_open_tag_id_fkey` FOREIGN KEY (`open_tag_id`) REFERENCES `email_tags`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_automations` ADD CONSTRAINT `email_automations_click_tag_id_fkey` FOREIGN KEY (`click_tag_id`) REFERENCES `email_tags`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
