-- AlterTable
ALTER TABLE `cpa_offer_clicks` ADD COLUMN `sub_id_2` VARCHAR(191) NULL,
    ADD COLUMN `sub_id_3` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `digital_product_clicks` ADD COLUMN `sub_id_2` VARCHAR(191) NULL,
    ADD COLUMN `sub_id_3` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `webhook_events` ADD COLUMN `sub_id_2` VARCHAR(191) NULL,
    ADD COLUMN `sub_id_3` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `digital_product_subscription_attributions` ADD COLUMN `sub_id_2` VARCHAR(191) NULL,
    ADD COLUMN `sub_id_3` VARCHAR(191) NULL;
