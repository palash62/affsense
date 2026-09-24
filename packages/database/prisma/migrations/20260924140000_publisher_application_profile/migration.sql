-- AlterTable
ALTER TABLE `publisher_profiles` ADD COLUMN `username` VARCHAR(191) NULL,
    ADD COLUMN `application_profile` JSON NULL;

-- CreateIndex
CREATE UNIQUE INDEX `publisher_profiles_username_key` ON `publisher_profiles`(`username`);
