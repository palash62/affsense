import { test, expect, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const TAG = `e2e-solo-${Date.now()}`;
const PASSWORD = "password123";
const SETTINGS_KEY = "solo_ads";

const ids = { admin: "", publisher: "", other: "", offer: "", otherCampaign: "", campaign: "" };
let originalSetting: Prisma.JsonValue | null = null;

async function login(browser: Browser, email: string, dashboard: RegExp): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Verification code").waitFor({ timeout: 30_000 });
  const otp = await page.request.post("/api/test/login-otp", { data: { email } });
  expect(otp.ok()).toBeTruthy();
  await page.getByLabel("Verification code").fill((await otp.json()).code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(dashboard, { timeout: 180_000 });
  return page;
}

test.describe.serial("Solo Ads affiliate and admin flows", () => {
  test.setTimeout(420_000);

  test.beforeAll(async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const make = (suffix: string, role: "ADMIN" | "PUBLISHER") =>
      prisma.user.create({
        data: { email: `${TAG}-${suffix}@qa.local`, name: `E2E ${suffix}`, passwordHash, role, status: "ACTIVE", emailVerified: new Date() },
      });
    ids.admin = (await make("admin", "ADMIN")).id;
    ids.publisher = (await make("pub", "PUBLISHER")).id;
    ids.other = (await make("other", "PUBLISHER")).id;

    ids.offer = (
      await prisma.cpaOffer.create({
        data: {
          name: `${TAG} offer`,
          network: "QA",
          category: "QA",
          previewUrl: "https://example.com/preview",
          trackingUrl: "https://offer.example.com/go?cid={click_id}",
          revenue: new Prisma.Decimal(30),
          payout: new Prisma.Decimal(20),
          postbackToken: `${TAG}-pb`,
          status: "ACTIVE",
          visibility: "PUBLIC",
        },
      })
    ).id;

    const existing = await prisma.platformSetting.findUnique({ where: { key: SETTINGS_KEY } });
    originalSetting = existing?.value ?? null;
    const value = {
      ...((existing?.value as object) ?? {}),
      enabled: true,
      betaOnly: true,
      betaPublisherIds: [ids.publisher, ids.other],
      supportedCountries: ["US", "GB", "CA"],
      regularCpcCents: 45,
      minDailyBudgetCents: 1000,
    };
    await prisma.platformSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value }, update: { value } });

    const wallet = await prisma.soloWallet.create({ data: { publisherId: ids.publisher, balanceCents: 5000 } });
    await prisma.soloWalletLedger.create({
      data: { walletId: wallet.id, type: "ADJUSTMENT", amountCents: 5000, balanceAfterCents: 5000, idempotencyKey: `${TAG}-fund`, sourceType: "qa", reason: "E2E funding" },
    });

    ids.otherCampaign = (
      await prisma.soloCampaign.create({
        data: {
          publisherId: ids.other,
          name: `${TAG} other`,
          offerType: "CPA",
          cpaOfferId: ids.offer,
          trafficType: "REGULAR",
          destinationMode: "DIRECT",
          countries: ["US"],
          dailyBudgetCents: 1000,
          lifetimeBudgetCents: 5000,
          cpcCentsSnapshot: 45,
        },
      })
    ).id;
  });

  test.afterAll(async () => {
    const users = [ids.admin, ids.publisher, ids.other].filter(Boolean);
    await prisma.soloCampaign.deleteMany({ where: { publisherId: { in: users } } });
    const wallets = await prisma.soloWallet.findMany({ where: { publisherId: { in: users } }, select: { id: true } });
    await prisma.soloWalletLedger.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
    await prisma.soloWallet.deleteMany({ where: { publisherId: { in: users } } });
    await prisma.soloProvider.deleteMany({ where: { realName: { startsWith: TAG } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.cpaOffer.deleteMany({ where: { id: ids.offer } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    if (originalSetting === null) await prisma.platformSetting.deleteMany({ where: { key: SETTINGS_KEY } });
    else await prisma.platformSetting.update({ where: { key: SETTINGS_KEY }, data: { value: originalSetting as Prisma.InputJsonValue } });
    await prisma.$disconnect();
  });

  test("affiliate creates a campaign, submits it and sees reports and wallet", async ({ browser }) => {
    const page = await login(browser, `${TAG}-pub@qa.local`, /\/publisher/);

    await page.goto("/publisher/solo-ads");
    await expect(page.getByRole("heading", { name: "Solo Ads", exact: true })).toBeVisible();
    await expect(page.getByText("Ad wallet available")).toBeVisible();

    await page.goto("/publisher/solo-ads/campaigns/new");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Campaign name").fill(`${TAG} campaign`);
    await page.locator("#c-offer").selectOption(`CPA:${ids.offer}`);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await page.waitForURL(/\/publisher\/solo-ads\/campaigns\/(?!new$)[a-z0-9]+$/, { timeout: 60_000 });
    ids.campaign = page.url().split("/").pop()!;
    await expect(page.getByText("Pending Review").first()).toBeVisible();

    const idor = await page.request.get(`/api/v1/publisher/solo-ads/campaigns/${ids.otherCampaign}`);
    expect(idor.status()).toBe(403);
    const idorBlock = await page.request.put(`/api/v1/publisher/solo-ads/campaigns/${ids.otherCampaign}/providers/101/block`, {
      data: { blocked: true },
    });
    expect([403, 404]).toContain(idorBlock.status());

    await page.goto("/publisher/solo-ads/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    const csv = await page.request.get("/api/v1/publisher/solo-ads/reports/export?groupBy=day");
    expect(csv.ok()).toBeTruthy();
    expect(csv.headers()["content-type"]).toContain("text/csv");

    await page.goto("/publisher/solo-ads/wallet");
    await expect(page.getByText("Available to spend")).toBeVisible();
    await expect(page.getByText("$50.00").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add funds", exact: true })).toBeVisible();
  });

  test("admin approves the campaign and issues a provider link", async ({ browser }) => {
    const page = await login(browser, `${TAG}-admin@qa.local`, /\/admin/);

    await page.goto("/admin/solo-ads/campaigns");
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("row").filter({ hasText: `${TAG} campaign` });
    await row.getByRole("button", { name: "Approve" }).click();
    await expect
      .poll(async () => (await prisma.soloCampaign.findUnique({ where: { id: ids.campaign } }))?.status, { timeout: 30_000 })
      .toBe("ACTIVE");
    await expect(row).toHaveCount(0);

    await page.goto("/admin/solo-ads/providers");
    await page.waitForLoadState("networkidle");
    await expect(async () => {
      await page.getByRole("button", { name: "Add provider" }).click();
      await expect(page.getByLabel("Real name (internal only)")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 60_000 });
    await page.getByLabel("Real name (internal only)").fill(`${TAG} provider`);
    await page.getByRole("button", { name: "Save" }).click();
    const providerRow = page.getByRole("row").filter({ hasText: `${TAG} provider` });
    await expect(providerRow).toBeVisible({ timeout: 30_000 });
    await providerRow.getByRole("button", { name: "Regular link" }).click();
    await expect(page.locator("code").filter({ hasText: /\/sa\/regular\?token=spr_/ })).toBeVisible({ timeout: 30_000 });

    await page.goto("/admin/solo-ads");
    await expect(page.getByText("Reconciliation")).toBeVisible();
    await page.goto("/admin/solo-ads/fraud");
    await expect(page.getByText("Why clicks were not billed")).toBeVisible();
    await page.goto("/admin/solo-ads/wallets");
    await expect(page.getByText("Total ad credit liability")).toBeVisible();
  });

  test("affiliate sees the approved campaign as active", async ({ browser }) => {
    const page = await login(browser, `${TAG}-pub@qa.local`, /\/publisher/);
    await page.goto(`/publisher/solo-ads/campaigns/${ids.campaign}`);
    await expect(page.getByText("Active", { exact: true }).first()).toBeVisible();
  });
});
