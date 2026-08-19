/**
 * Wipes all transactional data while preserving platform_settings.
 * Run: npx tsx packages/database/reset-data.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Wiping transactional data (platform_settings preserved)...");

  // Promotion tracking
  await prisma.promotionEvent.deleteMany();
  await prisma.promotion.deleteMany();

  // Task submissions (FK on GetPaidTask)
  await prisma.publisherTaskSubmission.deleteMany();
  await prisma.getPaidTask.deleteMany();
  await prisma.getPaidTaskCategory.deleteMany();

  // Digital products
  await prisma.digitalProduct.deleteMany();
  await prisma.digitalProductCategory.deleteMany();

  // Announcements
  await prisma.publisherAnnouncement.deleteMany();

  // CPA
  await prisma.cpaPostbackDelivery.deleteMany();
  await prisma.cpaOfferConversion.deleteMany();
  await prisma.cpaOfferClick.deleteMany();
  await prisma.cpaEarning.deleteMany();
  await prisma.cpaWallet.deleteMany();
  await prisma.cpaOffer.deleteMany();

  // Email marketing (in dependency order)
  await prisma.emailEvent.deleteMany();
  await prisma.emailSend.deleteMany();
  await prisma.emailBroadcast.deleteMany();
  await prisma.emailAutomationStep.deleteMany();
  await prisma.emailAutomation.deleteMany();
  await prisma.emailContactTag.deleteMany();
  await prisma.emailTag.deleteMany();
  await prisma.emailContact.deleteMany();
  await prisma.emailList.deleteMany();
  await prisma.emailTemplate.deleteMany();
  await prisma.emailWalletLedger.deleteMany();
  await prisma.emailWallet.deleteMany();
  await prisma.advertiserSendingMailbox.deleteMany();
  await prisma.advertiserSendingIdentity.deleteMany();
  await prisma.advertiserEmailSettings.deleteMany();

  // Autoresponder
  await prisma.autoresponderDelivery.deleteMany();
  await prisma.advertiserAutoresponder.deleteMany();

  // Landing pages / funnels
  await prisma.funnelEvent.deleteMany();
  await prisma.pageTemplateFavorite.deleteMany();
  await prisma.pageTemplate.deleteMany();
  await prisma.landingPageAsset.deleteMany();
  await prisma.landingPageVersion.deleteMany();
  await prisma.landingPage.deleteMany();
  await prisma.advertiserOptinPage.deleteMany();

  // Pixel events
  await prisma.pixelEvent.deleteMany();

  // Leads (all dependent models first)
  await prisma.leadValidationResult.deleteMany();
  await prisma.leadStatusHistory.deleteMany();
  await prisma.leadDeviceSeen.deleteMany();
  await prisma.lead.deleteMany();

  // Tracking
  await prisma.publisherSmartLink.deleteMany();
  await prisma.trackingLink.deleteMany();
  await prisma.click.deleteMany();

  // Finance
  await prisma.platformFee.deleteMany();
  await prisma.partnerPayment.deleteMany();
  await prisma.ledgerEntry.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.payout.deleteMany();

  // Campaigns
  await prisma.publisherCampaign.deleteMany();
  await prisma.campaignField.deleteMany();
  await prisma.campaign.deleteMany();

  // Domains / blocked
  await prisma.advertiserPublisherBlock.deleteMany();
  await prisma.advertiserDomain.deleteMany();
  await prisma.optinFunnelVersion.deleteMany();

  // Profiles
  await prisma.publisherProfile.deleteMany();
  await prisma.advertiserProfile.deleteMany();

  // Support
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();

  // Notifications
  await prisma.notification.deleteMany();

  // Tutorials
  await prisma.tutorial.deleteMany();

  // Auth tokens / logs
  await prisma.auditLog.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.loginOtpToken.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.impersonationToken.deleteMany();
  await prisma.ipBlocklist.deleteMany();

  // Wallets (after ledger entries cleared)
  await prisma.wallet.deleteMany();

  // Users last
  await prisma.user.deleteMany();

  console.log("Done. All transactional data wiped.");
  console.log("Run 'npm run db:seed' to create the admin user and platform settings.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
