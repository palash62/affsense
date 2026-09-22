-- AlterEnum: allow advertiser-submitted offers awaiting admin payout + activation
ALTER TABLE `cpa_offers` MODIFY COLUMN `status` ENUM('PENDING', 'ACTIVE', 'PAUSED', 'ARCHIVED') NOT NULL DEFAULT 'PAUSED';
