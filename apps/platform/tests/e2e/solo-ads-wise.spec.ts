import { test, expect, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const TAG = `e2e-solo-wise-${Date.now()}`;
const PASSWORD = "password123";
const SOLO_KEY = "solo_ads";
const WISE_KEY = "admin_pay_wise";
const WISE_ID = "payments@affsense.test";

const ids = { admin: "", publisher: "", other: "" };
const original: Record<string, Prisma.JsonValue | null> = { [SOLO_KEY]: null, [WISE_KEY]: null };

async function login(browser: Browser, email: string, dashboard: RegExp): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Verification code").waitFor({ timeout: 60_000 });
  const otp = await page.request.post("/api/test/login-otp", { data: { email } });
  expect(otp.ok()).toBeTruthy();
  await page.getByLabel("Verification code").fill((await otp.json()).code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(dashboard, { timeout: 180_000 });
  return page;
}

async function walletOf(publisherId: string) {
  const wallet = await prisma.soloWallet.findUnique({ where: { publisherId } });
  const ledger = wallet
    ? await prisma.soloWalletLedger.aggregate({ where: { walletId: wallet.id }, _sum: { amountCents: true } })
    : null;
  return { balance: wallet?.balanceCents ?? 0, ledger: ledger?._sum.amountCents ?? 0 };
}

async function setSetting(key: string, value: Prisma.InputJsonValue) {
  await prisma.platformSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

test.describe.serial("Solo Ads Wise deposits", () => {
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

    for (const key of [SOLO_KEY, WISE_KEY]) {
      original[key] = (await prisma.platformSetting.findUnique({ where: { key } }))?.value ?? null;
    }
    await setSetting(SOLO_KEY, {
      ...((original[SOLO_KEY] as object) ?? {}),
      enabled: true,
      betaOnly: true,
      betaPublisherIds: [ids.publisher, ids.other],
      minDepositCents: 1000,
    });
    await setSetting(WISE_KEY, WISE_ID);
  });

  test.afterAll(async () => {
    const users = [ids.admin, ids.publisher, ids.other].filter(Boolean);
    await prisma.soloDeposit.deleteMany({ where: { publisherId: { in: users } } });
    const wallets = await prisma.soloWallet.findMany({ where: { publisherId: { in: users } }, select: { id: true } });
    await prisma.soloWalletLedger.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
    await prisma.soloWallet.deleteMany({ where: { publisherId: { in: users } } });
    await prisma.notification.deleteMany({ where: { userId: { in: users } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    for (const key of [SOLO_KEY, WISE_KEY]) {
      if (original[key] === null) await prisma.platformSetting.deleteMany({ where: { key } });
      else await prisma.platformSetting.update({ where: { key }, data: { value: original[key] as Prisma.InputJsonValue } });
    }
    await prisma.$disconnect();
  });

  test("affiliate submits a Wise payment from the ad wallet", async ({ browser }) => {
    const page = await login(browser, `${TAG}-pub@qa.local`, /\/publisher/);
    await page.goto("/publisher/solo-ads/wallet");
    await expect(page.getByRole("heading", { name: "Add funds", exact: true })).toBeVisible({ timeout: 120_000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#solo-wise-id")).toHaveValue(WISE_ID);

    await page.locator("#solo-wise-amount").fill("100");
    await page.locator("#solo-wise-reference").fill(`${TAG}-ref1`);
    await page.locator("#solo-wise-note").fill("Sent from my Wise USD balance");
    await page.getByRole("button", { name: "Submit Wise payment" }).click();
    await expect(page.getByText(/1 Wise payment is waiting for admin review/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Pending Review").first()).toBeVisible();

    const options = await page.request.get("/api/v1/publisher/solo-ads/wallet/funding-options");
    expect(options.ok()).toBeTruthy();
    expect((await options.json()).data.wise.receiveId).toBe(WISE_ID);

    const api = (data: object) => page.request.post("/api/v1/publisher/solo-ads/wallet/deposits/wise", { data });
    expect((await api({ amount: 100, reference: `${TAG}-ref1` })).status()).toBe(409);
    const code = async (data: object) => {
      const res = await api(data);
      return `${res.status()} ${(await res.json()).error?.code ?? ""}`.trim();
    };
    expect(await code({ amount: 5, reference: `${TAG}-small` })).toBe("422 VALIDATION_ERROR");
    expect(await code({ amount: 50, reference: "" })).toBe("422 VALIDATION_ERROR");
    expect(await code({ amount: 20, reference: `${TAG}-ref2` })).toBe("201");
    expect(await code({ amount: 30, reference: `${TAG}-ref3` })).toBe("201");
    expect(await code({ amount: 40, reference: `${TAG}-ref4` })).toBe("422 TOO_MANY_PENDING_DEPOSITS");

    const wise = await prisma.soloDeposit.findFirstOrThrow({ where: { paymentReference: `${TAG}-ref1` } });
    const refresh = await page.request.post(`/api/v1/publisher/solo-ads/wallet/deposits/${wise.id}/refresh`);
    expect(refresh.ok()).toBeTruthy();
    expect((await refresh.json()).data.status).toBe("PENDING");
    expect((await walletOf(ids.publisher)).balance).toBe(0);

    const approveAsPublisher = await page.request.post(`/api/v1/admin/solo-ads/deposits/${wise.id}/approve`, { data: {} });
    expect(approveAsPublisher.status()).toBe(403);
  });

  test("admin approves with a lower amount, rejects another, and money is credited once", async ({ browser }) => {
    const page = await login(browser, `${TAG}-admin@qa.local`, /\/admin/);
    await page.goto("/admin/solo-ads");
    await expect(page.getByText(/Wise deposits? (is|are) waiting for your review/)).toBeVisible({ timeout: 120_000 });

    await page.goto("/admin/solo-ads/wallets");
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("row").filter({ hasText: `${TAG}-ref1` });
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.getByRole("button", { name: "Approve" }).click();
    const credit = page.getByLabel("Amount to credit (USD)");
    await credit.fill("97.50");
    await page.getByRole("button", { name: "Approve and credit" }).click();
    await expect
      .poll(async () => (await prisma.soloDeposit.findFirst({ where: { paymentReference: `${TAG}-ref1` } }))?.status, { timeout: 30_000 })
      .toBe("SUCCEEDED");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(row).toHaveCount(0, { timeout: 30_000 });

    const approved = await prisma.soloDeposit.findFirstOrThrow({ where: { paymentReference: `${TAG}-ref1` } });
    expect(approved.status).toBe("SUCCEEDED");
    expect(approved.amountCents).toBe(9750);
    expect(approved.reviewedById).toBe(ids.admin);

    const again = await page.request.post(`/api/v1/admin/solo-ads/deposits/${approved.id}/approve`, { data: {} });
    expect(again.ok()).toBeTruthy();
    let wallet = await walletOf(ids.publisher);
    expect(wallet.balance).toBe(9750);
    expect(wallet.ledger).toBe(wallet.balance);

    const rejectRow = page.getByRole("row").filter({ hasText: `${TAG}-ref2` });
    await rejectRow.getByRole("button", { name: "Reject" }).click();
    await page.getByLabel("Reason (shown to the affiliate)").fill("No matching payment in Wise");
    await page.getByRole("button", { name: "Reject deposit" }).click();
    await expect
      .poll(async () => (await prisma.soloDeposit.findFirst({ where: { paymentReference: `${TAG}-ref2` } }))?.status, { timeout: 30_000 })
      .toBe("REJECTED");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rejectRow).toHaveCount(0, { timeout: 30_000 });

    const rejected = await prisma.soloDeposit.findFirstOrThrow({ where: { paymentReference: `${TAG}-ref2` } });
    expect(rejected.status).toBe("REJECTED");
    const approveRejected = await page.request.post(`/api/v1/admin/solo-ads/deposits/${rejected.id}/approve`, { data: {} });
    expect(approveRejected.status()).toBe(409);

    const pending = await prisma.soloDeposit.findFirstOrThrow({ where: { paymentReference: `${TAG}-ref3` } });
    const tooMuch = await page.request.post(`/api/v1/admin/solo-ads/deposits/${pending.id}/approve`, { data: { amount: 31 } });
    expect(tooMuch.status()).toBe(422);
    const shortReason = await page.request.post(`/api/v1/admin/solo-ads/deposits/${pending.id}/reject`, { data: { reason: "no" } });
    expect(shortReason.status()).toBe(422);

    wallet = await walletOf(ids.publisher);
    expect(wallet.balance).toBe(9750);
    expect(wallet.ledger).toBe(wallet.balance);

    await page.goto("/admin/solo-ads/settings");
    await expect(page.getByText("Wise payments enabled")).toBeVisible({ timeout: 120_000 });
  });

  test("affiliate sees approved and rejected payments and can resubmit a rejected reference", async ({ browser }) => {
    const page = await login(browser, `${TAG}-pub@qa.local`, /\/publisher/);
    await page.goto("/publisher/solo-ads/wallet");
    await expect(page.getByText("No matching payment in Wise")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("$97.50").first()).toBeVisible();

    const resubmit = await page.request.post("/api/v1/publisher/solo-ads/wallet/deposits/wise", {
      data: { amount: 20, reference: `${TAG}-ref2` },
    });
    expect(resubmit.status()).toBe(201);
  });
});
