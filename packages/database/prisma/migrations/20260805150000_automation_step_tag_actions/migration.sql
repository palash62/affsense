-- AlterTable
ALTER TABLE `email_automation_steps` ADD COLUMN `type` ENUM('SEND_EMAIL', 'APPLY_TAG', 'REMOVE_TAG') NOT NULL DEFAULT 'SEND_EMAIL';
ALTER TABLE `email_automation_steps` ADD COLUMN `tag_id` VARCHAR(191) NULL;

-- DropForeignKey (MySQL: allow null template)
ALTER TABLE `email_automation_steps` DROP FOREIGN KEY `email_automation_steps_template_id_fkey`;

-- AlterColumn template_id nullable
ALTER TABLE `email_automation_steps` MODIFY `template_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `email_automation_steps` ADD CONSTRAINT `email_automation_steps_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `email_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_automation_steps` ADD CONSTRAINT `email_automation_steps_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `email_tags`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `email_automation_steps_tag_id_idx` ON `email_automation_steps`(`tag_id`);
