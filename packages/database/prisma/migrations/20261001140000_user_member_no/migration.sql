-- AlterTable
ALTER TABLE `users` ADD COLUMN `member_no` INTEGER NULL;

-- Backfill existing users from 100001 in signup order
UPDATE `users` u
JOIN (
    SELECT `id`, ROW_NUMBER() OVER (ORDER BY `created_at`, `id`) + 100000 AS `rn`
    FROM `users`
) r ON r.`id` = u.`id`
SET u.`member_no` = r.`rn`;

-- Auto increment continues after the highest backfilled value
ALTER TABLE `users`
    MODIFY `member_no` INTEGER NOT NULL AUTO_INCREMENT,
    ADD UNIQUE INDEX `users_member_no_key`(`member_no`);

ALTER TABLE `users` AUTO_INCREMENT = 100001;
