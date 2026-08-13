import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { seedAffsenseCatalog } from "./seed-affsense-catalog";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.platformSetting.upsert({
    where: { key: "publisher_payout_percent" },
    create: { key: "publisher_payout_percent", value: 70 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "min_payout_amount" },
    create: { key: "min_payout_amount", value: 50 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "min_payout_wise" },
    create: { key: "min_payout_wise", value: 50 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "min_payout_bank_transfer" },
    create: { key: "min_payout_bank_transfer", value: 100 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "min_payout_stripe_connect" },
    create: { key: "min_payout_stripe_connect", value: 50 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "duplicate_window_days" },
    create: { key: "duplicate_window_days", value: 30 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier1_payout_min" },
    create: { key: "tier1_payout_min", value: 0.7 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier1_payout_max" },
    create: { key: "tier1_payout_max", value: 2.5 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier2_payout_min" },
    create: { key: "tier2_payout_min", value: 0.5 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier2_payout_max" },
    create: { key: "tier2_payout_max", value: 1.8 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier3_payout_min" },
    create: { key: "tier3_payout_min", value: 0.25 },
    update: {},
  });
  await prisma.platformSetting.upsert({
    where: { key: "tier3_payout_max" },
    create: { key: "tier3_payout_max", value: 1.0 },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@cpl.local" },
    create: {
      email: "admin@cpl.local",
      passwordHash,
      name: "Platform Admin",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallet: { create: {} },
    },
    update: { status: "ACTIVE" },
  });

  const advertiser = await prisma.user.upsert({
    where: { email: "advertiser@cpl.local" },
    create: {
      email: "advertiser@cpl.local",
      passwordHash,
      name: "Demo Advertiser",
      role: "ADVERTISER",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallet: { create: { balance: 1000 } },
      advertiserProfile: { create: { company: "Demo Corp" } },
    },
    update: { status: "ACTIVE" },
  });

  const publisher = await prisma.user.upsert({
    where: { email: "publisher@cpl.local" },
    create: {
      email: "publisher@cpl.local",
      passwordHash,
      name: "Demo Publisher",
      role: "PUBLISHER",
      status: "ACTIVE",
      emailVerified: new Date(),
      wallet: { create: { balance: 250 } },
      publisherProfile: {
        create: {
          kycStatus: "APPROVED",
          website: "https://demo-publisher.example",
          country: "US",
          city: "New York",
          state: "NY",
        },
      },
    },
    update: {
      status: "ACTIVE",
      wallet: { upsert: { create: { balance: 250 }, update: { balance: 250 } } },
    },
  });

  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-001" },
    create: {
      id: "seed-campaign-001",
      advertiserId: advertiser.id,
      name: "Finance Leads Demo",
      description: "Sample finance lead generation campaign",
      category: "FINANCE",
      cpl: 25,
      budget: 500,
      status: "ACTIVE",
      publisherAccess: "OPEN",
      autoApprove: true,
      targeting: { countries: ["US"] },
      fields: {
        create: [
          { fieldName: "first_name", label: "First Name", fieldType: "text", required: true, sortOrder: 0 },
          { fieldName: "email", label: "Email", fieldType: "email", required: true, sortOrder: 1 },
          { fieldName: "phone", label: "Phone", fieldType: "phone", required: true, sortOrder: 2 },
        ],
      },
    },
    update: { status: "ACTIVE" },
  });

  await prisma.publisherCampaign.upsert({
    where: {
      publisherId_campaignId: {
        publisherId: publisher.id,
        campaignId: campaign.id,
      },
    },
    create: {
      publisherId: publisher.id,
      campaignId: campaign.id,
      status: "APPROVED",
      approvedAt: new Date(),
    },
    update: { status: "APPROVED" },
  });

  const link = await prisma.trackingLink.upsert({
    where: { slug: "demo-link" },
    create: {
      publisherId: publisher.id,
      campaignId: campaign.id,
      slug: "demo-link",
    },
    update: {},
  });

  const existingPendingPayout = await prisma.payout.findFirst({
    where: {
      publisherId: publisher.id,
      status: { in: ["PENDING", "REQUESTED"] },
    },
  });

  if (!existingPendingPayout) {
    await prisma.payout.create({
      data: {
        publisherId: publisher.id,
        amount: 100,
        method: "WISE",
        status: "PENDING",
        paymentDetails: { email: "publisher@cpl.local" },
      },
    });
  }

  await seedAffsenseCatalog(prisma);

  console.log("Seed complete:");
  console.log("  Admin:      admin@cpl.local / password123");
  console.log("  Advertiser: advertiser@cpl.local / password123");
  console.log("  Publisher:  publisher@cpl.local / password123");
  console.log(`  Demo form:  /t/${link.slug}`);
  console.log("  Admin ID:", admin.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
