-- AlterTable
ALTER TABLE `publisher_profiles`
  ADD COLUMN `payout_wise_id` VARCHAR(191) NULL,
  ADD COLUMN `payout_bank_details` JSON NULL,
  ADD COLUMN `default_payout_method` ENUM('WISE', 'BANK_TRANSFER', 'STRIPE_CONNECT', 'PAYPAL') NULL;

-- AlterTable
ALTER TABLE `affiliate_invoices`
  ADD COLUMN `payee_method` ENUM('WISE', 'BANK_TRANSFER', 'STRIPE_CONNECT', 'PAYPAL') NULL,
  ADD COLUMN `payee_details` JSON NULL;
