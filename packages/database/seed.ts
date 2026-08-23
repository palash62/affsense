import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedPassword = "palash@123@#";
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  // Platform settings — upsert so re-running never overwrites manually changed values
  const settings: Array<{ key: string; value: unknown }> = [
    { key: "publisher_payout_percent", value: 70 },
    { key: "min_payout_amount", value: 50 },
    { key: "min_payout_wise", value: 50 },
    { key: "min_payout_bank_transfer", value: 100 },
    { key: "min_payout_stripe_connect", value: 50 },
    { key: "duplicate_window_days", value: 30 },
    { key: "tier1_payout_min", value: 0.7 },
    { key: "tier1_payout_max", value: 2.5 },
    { key: "tier2_payout_min", value: 0.5 },
    { key: "tier2_payout_max", value: 1.8 },
    { key: "tier3_payout_min", value: 0.25 },
    { key: "tier3_payout_max", value: 1.0 },
  ];

  for (const s of settings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: {},
    });
  }

  const admins: Array<{ email: string; name: string }> = [
    { email: "admin@leadvix.io", name: "Admin" },
    { email: "ppalash62@gmail.com", name: "Palash" },
    { email: "affsensellc@gmail.com", name: "Affsense LLC" },
  ];

  console.log("Seed complete:");
  for (const a of admins) {
    const admin = await prisma.user.upsert({
      where: { email: a.email },
      create: {
        email: a.email,
        passwordHash,
        name: a.name,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: new Date(),
        wallet: { create: {} },
      },
      update: {
        passwordHash,
        status: "ACTIVE",
        role: "ADMIN",
        emailVerified: new Date(),
      },
    });
    console.log(`  Admin: ${a.email} / ${seedPassword}`);
    console.log(`  Admin ID: ${admin.id}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
