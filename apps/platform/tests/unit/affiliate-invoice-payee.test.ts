import { beforeEach, describe, expect, it, vi } from "vitest";

const txMock = {
  publisherProfile: { findUnique: vi.fn() },
  ledgerEntry: { updateMany: vi.fn() },
  payout: { create: vi.fn() },
  affiliateInvoice: { update: vi.fn() },
  auditLog: { create: vi.fn() },
};

const prismaMock = {
  affiliateInvoice: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => unknown) => fn(txMock)),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/wallet.service", () => ({
  debitWalletForPayout: vi.fn(),
  getPlatformSettings: vi.fn(),
  holdWalletFunds: vi.fn(),
  reconcileAllDigitalCommissions: vi.fn(),
  reconcilePublisherDigitalCommissionsForUser: vi.fn(),
  releaseWalletHold: vi.fn(),
}));
vi.mock("@/services/notify.service", () => ({
  notifyApproved: vi.fn(),
  notifyUserById: vi.fn(),
}));
vi.mock("@/services/affiliate-invoicing-settings.service", () => ({
  loadAffiliateInvoicingConfig: vi.fn(),
}));

const { affiliateInvoiceDueAt, getAffiliateInvoiceById, payAffiliateInvoice } = await import(
  "@/services/affiliate-invoice.service"
);

const wiseProfile = {
  defaultPayoutMethod: "WISE",
  payoutWiseId: "live@wise.example",
  payoutBankDetails: null,
};

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    number: "AFF-2026-00001",
    publisherId: "pub-1",
    periodStart: new Date("2026-09-28T00:00:00Z"),
    periodEnd: new Date("2026-10-04T23:59:59Z"),
    issuedAt: new Date("2026-10-05T00:00:00Z"),
    dueAt: new Date("2026-10-07T00:00:00Z"),
    total: 120,
    currency: "USD",
    status: "UNPAID",
    paidAt: null,
    paymentMethod: null,
    paymentReference: null,
    adminNote: null,
    cancelReason: null,
    payeeMethod: "BANK_TRANSFER",
    payeeDetails: { old: true },
    lines: [],
    publisher: { id: "pub-1", name: "Pub", email: "pub@example.com", publisherProfile: wiseProfile },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("affiliateInvoiceDueAt", () => {
  it("is 48 hours after the issue time", () => {
    const issued = new Date("2026-10-05T09:30:00Z");
    expect(affiliateInvoiceDueAt(issued).toISOString()).toBe("2026-10-07T09:30:00.000Z");
  });
});

describe("invoice payee", () => {
  it("shows the affiliate's current default method on unpaid invoices", async () => {
    prismaMock.affiliateInvoice.findUnique.mockResolvedValue(invoiceRow());

    const invoice = await getAffiliateInvoiceById("inv-1");

    expect(invoice.payeeMethod).toBe("WISE");
    expect(invoice.payeeDetails).toEqual({ email: "live@wise.example" });
  });

  it("shows nothing when an unpaid invoice's affiliate has no default method", async () => {
    prismaMock.affiliateInvoice.findUnique.mockResolvedValue(
      invoiceRow({ publisher: { id: "pub-1", name: "Pub", email: "p@x.com", publisherProfile: null } }),
    );

    const invoice = await getAffiliateInvoiceById("inv-1");

    expect(invoice.payeeMethod).toBeNull();
    expect(invoice.payeeDetails).toBeNull();
  });

  it("keeps the stored details on paid invoices", async () => {
    prismaMock.affiliateInvoice.findUnique.mockResolvedValue(
      invoiceRow({ status: "PAID", paidAt: new Date() }),
    );

    const invoice = await getAffiliateInvoiceById("inv-1");

    expect(invoice.payeeMethod).toBe("BANK_TRANSFER");
    expect(invoice.payeeDetails).toEqual({ old: true });
  });

  it("saves the current default method on the invoice when it is paid", async () => {
    prismaMock.affiliateInvoice.findUnique.mockResolvedValue({
      id: "inv-1",
      number: "AFF-2026-00001",
      publisherId: "pub-1",
      status: "UNPAID",
      total: 120,
    });
    txMock.publisherProfile.findUnique.mockResolvedValue(wiseProfile);
    txMock.payout.create.mockResolvedValue({ id: "payout-1" });
    prismaMock.affiliateInvoice.findUniqueOrThrow.mockResolvedValue({
      ...invoiceRow({ status: "PAID" }),
      publisher: { id: "pub-1", name: "Pub", email: "pub@example.com" },
    });

    await payAffiliateInvoice("inv-1", { method: "WISE", reference: "T-1" }, "admin-1");

    expect(txMock.affiliateInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PAID",
          paymentMethod: "WISE",
          payeeMethod: "WISE",
          payeeDetails: { email: "live@wise.example" },
        }),
      }),
    );
  });
});
