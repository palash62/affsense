import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  platformSetting: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
  },
  payout: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  },
  wallet: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  ledgerEntry: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/services/notify.service", () => ({
  notifyAdminAlert: vi.fn(),
  notifyApproved: vi.fn(),
  notifyRejected: vi.fn(),
}));

describe("payout.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn(prismaMock),
    );
    // Self-service payout requests only apply when weekly invoicing is off.
    prismaMock.platformSetting.findUnique.mockResolvedValue({
      key: "affiliate_invoicing",
      value: { enabled: false },
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("requestPayout", () => {
    it("rejects requests when weekly invoicing is enabled", async () => {
      prismaMock.platformSetting.findUnique.mockResolvedValue({
        key: "affiliate_invoicing",
        value: { enabled: true },
      });

      const { requestPayout } = await import("@/services/payout.service");
      await expect(
        requestPayout("pub-1", 100, "WISE", { email: "pay@example.com" }),
      ).rejects.toMatchObject({ code: "PAYOUT_VIA_INVOICE" });
    });

    it("rejects amounts below method minimum", async () => {
      const { requestPayout } = await import("@/services/payout.service");
      await expect(
        requestPayout("pub-1", 10, "BANK_TRANSFER", { accountName: "Test" }),
      ).rejects.toMatchObject({ code: "PAYOUT_BELOW_MINIMUM" });
    });

    it("rejects when available balance is insufficient", async () => {
      prismaMock.wallet.findUniqueOrThrow.mockResolvedValue({
        id: "wallet-1",
        balance: 100,
        holdBalance: 80,
      });

      const { requestPayout } = await import("@/services/payout.service");
      await expect(
        requestPayout("pub-1", 50, "WISE", { email: "pay@example.com" }),
      ).rejects.toMatchObject({ code: "WALLET_INSUFFICIENT_FUNDS" });
    });

    it("holds funds and creates a pending payout", async () => {
      prismaMock.wallet.findUniqueOrThrow.mockResolvedValue({
        id: "wallet-1",
        balance: 100,
        holdBalance: 0,
      });
      prismaMock.payout.create.mockResolvedValue({
        id: "payout-1",
        publisher: { id: "pub-1", name: "Pub", email: "pub@test.com" },
      });

      const { requestPayout } = await import("@/services/payout.service");
      const payout = await requestPayout("pub-1", 50, "WISE", { email: "pay@example.com" });

      expect(payout.id).toBe("payout-1");
      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { holdBalance: 50 },
        }),
      );
      expect(prismaMock.payout.create).toHaveBeenCalled();
    });
  });

  describe("approvePayout", () => {
    it("debits balance and releases hold on approval", async () => {
      prismaMock.payout.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "payout-1",
          publisherId: "pub-1",
          amount: 50,
          status: "PENDING",
        })
        .mockResolvedValueOnce({
          id: "payout-1",
          publisherId: "pub-1",
          amount: 50,
          status: "COMPLETED",
          publisher: { id: "pub-1", name: "Pub", email: "pub@test.com" },
        });

      prismaMock.wallet.findUniqueOrThrow.mockResolvedValue({
        id: "wallet-1",
        balance: 100,
        holdBalance: 50,
      });

      const { approvePayout } = await import("@/services/payout.service");
      await approvePayout("payout-1", "admin-1");

      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: 50, holdBalance: 0 },
        }),
      );
      expect(prismaMock.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "DEBIT",
            amount: 50,
            referenceType: "payout",
            referenceId: "payout-1",
          }),
        }),
      );
    });
  });

  describe("rejectPayout", () => {
    it("releases hold without debiting balance", async () => {
      prismaMock.payout.findUniqueOrThrow
        .mockResolvedValueOnce({
          id: "payout-1",
          publisherId: "pub-1",
          amount: 50,
          status: "PENDING",
        })
        .mockResolvedValueOnce({
          id: "payout-1",
          publisherId: "pub-1",
          amount: 50,
          status: "REJECTED",
          publisher: { id: "pub-1", name: "Pub", email: "pub@test.com" },
        });

      prismaMock.wallet.findUniqueOrThrow.mockResolvedValue({
        id: "wallet-1",
        balance: 100,
        holdBalance: 50,
      });

      const { rejectPayout } = await import("@/services/payout.service");
      await rejectPayout("payout-1", "admin-1", "Invalid bank details");

      expect(prismaMock.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { holdBalance: 0 },
        }),
      );
      expect(prismaMock.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });
});
