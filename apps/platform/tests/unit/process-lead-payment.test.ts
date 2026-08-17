import { beforeEach, describe, expect, it, vi } from "vitest";

const balances = new Map([
  ["advertiser-wallet", 10],
  ["publisher-wallet", 0],
]);
const ledgerEntries: Array<Record<string, unknown>> = [];

const prismaMock = {
  platformSetting: {
    findMany: vi.fn().mockResolvedValue([
      { key: "publisher_payout_percent", value: 70 },
      { key: "tier1_payout_min", value: 0.7 },
      { key: "tier1_payout_max", value: 2.5 },
    ]),
  },
  lead: {
    findUniqueOrThrow: vi.fn().mockResolvedValue({
      id: "lead-1",
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      isTest: false,
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "One dollar CPL",
        cpl: 1,
        spent: 0,
        budget: 100,
      },
      publisher: { role: "PUBLISHER" },
    }),
    update: vi.fn(),
  },
  wallet: {
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { userId: string } }) => {
      const id =
        where.userId === "advertiser-1" ? "advertiser-wallet" : "publisher-wallet";
      return { id, balance: balances.get(id) ?? 0, lowBalanceAlertTiers: [] };
    }),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { balance: number; lowBalanceAlertTiers?: number[] };
      }) => {
        balances.set(where.id, data.balance);
      },
    ),
    upsert: vi.fn().mockResolvedValue({ id: "publisher-wallet" }),
  },
  ledgerEntry: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      ledgerEntries.push(data);
      return data;
    }),
  },
  platformFee: { create: vi.fn() },
  campaign: { update: vi.fn() },
  user: {
    findUnique: vi.fn().mockResolvedValue({ referredBy: null }),
  },
  $transaction: vi.fn(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock),
  ),
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/notify.service", () => ({
  notifyAdminAlert: vi.fn(),
  notifyApproved: vi.fn(),
  notifyGeneric: vi.fn(),
  notifyRejected: vi.fn(),
  notifyUserById: vi.fn(),
  notifyLowBalanceTiers: vi.fn(),
  notifyCampaignBudgetReached: vi.fn(),
  notifyReferralCommission: vi.fn(),
}));
vi.mock("@/services/referral.service", () => ({
  creditReferralCommissionsForLead: vi.fn().mockResolvedValue([]),
}));

const dispatchPublisherPostback = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/publisher-postback-dispatch", () => ({
  dispatchPublisherPostback: (...args: unknown[]) => dispatchPublisherPostback(...args),
}));

describe("processLeadPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    balances.set("advertiser-wallet", 10);
    balances.set("publisher-wallet", 0);
    ledgerEntries.length = 0;
  });

  it("credits $0.70 to the publisher for a $1 CPL at 70%", async () => {
    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-1");

    expect(balances.get("advertiser-wallet")).toBe(9);
    expect(balances.get("publisher-wallet")).toBe(0.7);
    expect(ledgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DEBIT",
          amount: 1,
          referenceType: "lead",
          referenceId: "lead-1",
        }),
        expect.objectContaining({
          type: "CREDIT",
          amount: 0.7,
          referenceType: "lead",
          referenceId: "lead-1",
        }),
      ]),
    );
    expect(prismaMock.platformFee.create).toHaveBeenCalledWith({
      data: {
        leadId: "lead-1",
        feeAmount: 0.3,
        feePercent: 30,
      },
    });
    expect(prismaMock.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-1" },
      data: { status: "PAID", cpl: 1 },
    });
    await vi.waitFor(() => {
      expect(dispatchPublisherPostback).toHaveBeenCalledWith("lead-1");
    });
  });

  it("charges snapshotted lead.cpl when campaign bid has changed", async () => {
    balances.set("advertiser-wallet", 20);
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-old-bid",
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      isTest: false,
      cpl: 2,
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Updated bid campaign",
        cpl: 5,
        spent: 0,
        budget: 100,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-old-bid");

    expect(balances.get("advertiser-wallet")).toBe(18);
    expect(balances.get("publisher-wallet")).toBe(1.4);
    expect(prismaMock.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-old-bid" },
      data: { status: "PAID", cpl: 2 },
    });
    expect(ledgerEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "DEBIT",
          amount: 2,
          referenceType: "lead",
          referenceId: "lead-old-bid",
        }),
        expect.objectContaining({
          type: "CREDIT",
          amount: 1.4,
          referenceType: "lead",
          referenceId: "lead-old-bid",
        }),
      ]),
    );
  });

  it("refuses to pay test leads", async () => {
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-test",
      isTest: true,
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Test campaign",
        cpl: 1,
        spent: 0,
        budget: 100,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { processLeadPayment } = await import("@/services/wallet.service");

    await expect(processLeadPayment("lead-test")).rejects.toMatchObject({
      message: expect.stringContaining("Test leads"),
    });
    expect(prismaMock.ledgerEntry.create).not.toHaveBeenCalled();
    expect(dispatchPublisherPostback).not.toHaveBeenCalled();
  });

  it("keeps campaign active past budget and notifies advertiser once when budget is crossed", async () => {
    balances.set("advertiser-wallet", 100);
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-budget",
      isTest: false,
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Budget campaign",
        cpl: 10,
        spent: 95,
        budget: 100,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { notifyCampaignBudgetReached } = await import("@/services/notify.service");
    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-budget");

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      data: {
        spent: 105,
      },
    });
    expect(notifyCampaignBudgetReached).toHaveBeenCalledWith(
      "advertiser-1",
      expect.objectContaining({
        campaignId: "campaign-1",
        campaignName: "Budget campaign",
        budget: 100,
        spent: 105,
        cpl: 10,
      }),
    );
  });

  it("does not notify budget crossed when spend was already at or above budget", async () => {
    balances.set("advertiser-wallet", 100);
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-over-budget",
      isTest: false,
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Already over",
        cpl: 10,
        spent: 100,
        budget: 100,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { notifyCampaignBudgetReached } = await import("@/services/notify.service");
    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-over-budget");

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      data: { spent: 110 },
    });
    expect(notifyCampaignBudgetReached).not.toHaveBeenCalled();
  });

  it("does not notify budget crossed for unlimited (null) budget campaigns", async () => {
    balances.set("advertiser-wallet", 100);
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-unlimited",
      isTest: false,
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Unlimited campaign",
        cpl: 10,
        spent: 95,
        budget: null,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { notifyCampaignBudgetReached } = await import("@/services/notify.service");
    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-unlimited");

    expect(prismaMock.campaign.update).toHaveBeenCalledWith({
      where: { id: "campaign-1" },
      data: { spent: 105 },
    });
    expect(notifyCampaignBudgetReached).not.toHaveBeenCalled();
  });

  it("notifies low-balance tiers when debit crosses thresholds", async () => {
    balances.set("advertiser-wallet", 55);
    prismaMock.lead.findUniqueOrThrow.mockResolvedValueOnce({
      id: "lead-low",
      isTest: false,
      publisherId: "publisher-1",
      country: "US",
      campaignId: "campaign-1",
      campaign: {
        id: "campaign-1",
        advertiserId: "advertiser-1",
        name: "Low balance campaign",
        cpl: 55,
        spent: 0,
        budget: 500,
      },
      publisher: { role: "PUBLISHER" },
    });

    const { notifyLowBalanceTiers } = await import("@/services/notify.service");
    const { processLeadPayment } = await import("@/services/wallet.service");

    await processLeadPayment("lead-low");

    expect(notifyLowBalanceTiers).toHaveBeenCalledWith("advertiser-1", [50, 10, 0], 0);
  });
});
