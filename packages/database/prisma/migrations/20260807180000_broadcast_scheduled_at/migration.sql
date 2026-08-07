-- AlterTable
ALTER TABLE `email_broadcasts` ADD COLUMN `scheduled_at` DATETIME(3) NULL;
ALTER TABLE `email_broadcasts` ADD COLUMN `all_subscribers` BOOLEAN NOT NULL DEFAULT false;
