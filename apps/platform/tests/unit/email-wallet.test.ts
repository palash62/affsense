import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const prismaMock = {
  wallet: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  emailWallet: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  emailWalletLedger: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  platformSetting: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  ),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/services/wallet.service", () => ({
  debitWallet: vi.fn(async () => ({
    previousBalance: 100,
    newBalance: 90,
    crossedTiers: [],
  })),
}));

describe("email wallet math", () => {
  it("computes cost and remaining emails from rate", async () => {
    const { emailCostUsd, emailsRemaining } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );
    expect(emailCostUsd(100)).toBe(0.01);
    expect(emailsRemaining(1.5, 100)).toBe(150);
    expect(emailsRemaining(0.009, 100)).toBe(0);
    expect(emailsRemaining(0, 100)).toBe(0);
  });
});

describe("email wallet top-up and debit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ email: "other@example.com" });
    prismaMock.platformSetting.findUnique.mockResolvedValue({
      value: {
        enabled: true,
        maxAutomationsPerAdvertiser: 10,
        maxSendsPerDay: 5000,
        emailsPerDollar: 100,
      },
    });
  });

  it("tops up from main wallet when available", async () => {
    const { debitWallet } = await import("@/services/wallet.service");
    const { topUpFromMainWallet } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.wallet.findUnique.mockResolvedValue({
      balance: 50,
      holdBalance: 10,
      currency: "USD",
    });
    prismaMock.emailWallet.findUnique.mockResolvedValue({
      id: "ew1",
      advertiserId: "adv1",
      balance: 2,
      currency: "USD",
    });
    prismaMock.emailWallet.update.mockResolvedValue({});
    prismaMock.emailWalletLedger.create.mockResolvedValue({});

    const snap = await topUpFromMainWallet("adv1", 10);

    expect(debitWallet).toHaveBeenCalledWith(
      prismaMock,
      "adv1",
      10,
      "email_wallet_topup",
      expect.any(String),
      expect.stringContaining("10.00"),
    );
    expect(prismaMock.emailWallet.update).toHaveBeenCalledWith({
      where: { id: "ew1" },
      data: { balance: 12 },
    });
    expect(snap.balance).toBe(2);
    expect(snap.emailsRemaining).toBe(200);
  });

  it("rejects top-up when main available balance is too low", async () => {
    const { topUpFromMainWallet } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.wallet.findUnique.mockResolvedValue({
      balance: 12,
      holdBalance: 10,
      currency: "USD",
    });

    await expect(topUpFromMainWallet("adv1", 5)).rejects.toMatchObject({
      code: "WALLET_INSUFFICIENT_FUNDS",
    } satisfies Partial<AppError>);
  });

  it("debits send cost once and is idempotent on retry", async () => {
    const { debitForSend } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.emailWalletLedger.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "led1" });
    prismaMock.emailWallet.findUnique.mockResolvedValue({
      id: "ew1",
      advertiserId: "adv1",
      balance: 1,
      currency: "USD",
    });
    prismaMock.emailWallet.update.mockResolvedValue({});
    prismaMock.emailWalletLedger.create.mockResolvedValue({});

    await debitForSend("adv1", "send-1");
    await debitForSend("adv1", "send-1");

    expect(prismaMock.emailWallet.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.emailWalletLedger.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.emailWallet.update).toHaveBeenCalledWith({
      where: { id: "ew1" },
      data: { balance: 0.99 },
    });
  });

  it("fails debit when email wallet is empty", async () => {
    const { debitForSend } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.user.findUnique.mockResolvedValue({ email: "other@example.com" });
    prismaMock.emailWalletLedger.findFirst.mockResolvedValue(null);
    prismaMock.emailWallet.findUnique.mockResolvedValue({
      id: "ew1",
      advertiserId: "adv1",
      balance: 0,
      currency: "USD",
    });

    await expect(debitForSend("adv1", "send-2")).rejects.toMatchObject({
      code: "WALLET_INSUFFICIENT_FUNDS",
    });
  });

  it("demo advertiser bypasses hasEmailSendFunds with $0 balance", async () => {
    const { hasEmailSendFunds } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.user.findUnique.mockResolvedValue({ email: "advertiser@cpl.local" });

    const funds = await hasEmailSendFunds("demo-adv", 100);
    expect(funds.ok).toBe(true);
    expect(funds.cost).toBe(0);
    expect(prismaMock.emailWallet.findUnique).not.toHaveBeenCalled();
  });

  it("non-demo advertiser with $0 balance fails hasEmailSendFunds", async () => {
    const { hasEmailSendFunds } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.user.findUnique.mockResolvedValue({ email: "paid@example.com" });
    prismaMock.emailWallet.findUnique.mockResolvedValue({
      id: "ew1",
      advertiserId: "adv2",
      balance: 0,
      currency: "USD",
    });

    const funds = await hasEmailSendFunds("adv2", 100);
    expect(funds.ok).toBe(false);
    expect(funds.cost).toBe(0.01);
    expect(funds.balance).toBe(0);
  });

  it("demo advertiser debitForSend is a no-op", async () => {
    const { debitForSend } = await import(
      "@/modules/email-marketing/services/email-wallet.service"
    );

    prismaMock.user.findUnique.mockResolvedValue({ email: "advertiser@cpl.local" });

    const result = await debitForSend("demo-adv", "send-demo");
    expect(result.cost).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
