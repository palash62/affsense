import { describe, it, expect, vi, beforeEach } from "vitest";

type LedgerRow = {
  walletId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
};

const state = vi.hoisted(() => ({
  balance: 0,
  ledger: [] as LedgerRow[],
  commissions: new Map<string, { publisherId: string; commission: number; isRefund: boolean } | null>(),
  events: [] as Array<{ id: string }>,
}));

const mocks = vi.hoisted(() => {
  const tx = {
    wallet: {
      upsert: vi.fn(async () => ({ id: "wallet-1", userId: "pub-1" })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: "wallet-1",
        balance: state.balance,
        lowBalanceAlertTiers: [],
      })),
      update: vi.fn(async ({ data }: { data: { balance: number } }) => {
        state.balance = data.balance;
      }),
    },
    ledgerEntry: {
      findFirst: vi.fn(async ({ where }: { where: { referenceId: string } }) =>
        state.ledger.find((row) => row.referenceId === where.referenceId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: LedgerRow }) => {
        state.ledger.push(data);
      }),
    },
    $queryRaw: vi.fn(async () => []),
  };

  const prisma = {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    webhookEvent: {
      findMany: vi.fn(async () => state.events),
    },
    ledgerEntry: {
      findMany: vi.fn(async ({ where }: { where: { referenceId: { in: string[] } } }) =>
        state.ledger
          .filter((row) => where.referenceId.in.includes(row.referenceId))
          .map((row) => ({ referenceId: row.referenceId })),
      ),
    },
  };

  return { tx, prisma };
});

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));

vi.mock("@/services/digital-product.service", () => ({
  resolveWebhookEventCommissions: vi.fn(async (ids: string[]) => {
    const result = new Map();
    for (const id of ids) result.set(id, state.commissions.get(id) ?? null);
    return result;
  }),
}));

import {
  recordDigitalProductCommission,
  reconcilePublisherDigitalCommissionsForUser,
} from "@/services/wallet.service";
import { isWeeklyAutoInvoicing } from "@/lib/affiliate-invoicing-settings";

describe("marketplace commission ledger posting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.balance = 0;
    state.ledger = [];
    state.commissions = new Map();
    state.events = [];
  });

  it("credits a sale once, even when called again", async () => {
    state.commissions.set("evt-1", { publisherId: "pub-1", commission: 25.5, isRefund: false });

    expect(await recordDigitalProductCommission("evt-1")).toBe(true);
    expect(await recordDigitalProductCommission("evt-1")).toBe(false);

    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]).toMatchObject({
      type: "CREDIT",
      amount: 25.5,
      referenceType: "digital_product_sale",
      referenceId: "evt-1",
    });
    expect(state.balance).toBe(25.5);
  });

  it("debits a refund even when the balance goes below zero", async () => {
    state.balance = 5;
    state.commissions.set("evt-refund", { publisherId: "pub-1", commission: 20, isRefund: true });

    expect(await recordDigitalProductCommission("evt-refund")).toBe(true);

    expect(state.ledger[0]).toMatchObject({
      type: "DEBIT",
      amount: 20,
      balanceAfter: -15,
      referenceType: "digital_product_refund",
    });
    expect(state.balance).toBe(-15);
  });

  it("skips sales with no commission", async () => {
    state.commissions.set("evt-none", null);
    expect(await recordDigitalProductCommission("evt-none")).toBe(false);
    expect(state.ledger).toHaveLength(0);
  });

  it("reconcile backfills only events without a ledger entry", async () => {
    state.events = [{ id: "evt-a" }, { id: "evt-b" }];
    state.commissions.set("evt-a", { publisherId: "pub-1", commission: 10, isRefund: false });
    state.commissions.set("evt-b", { publisherId: "pub-1", commission: 4, isRefund: false });

    expect(await reconcilePublisherDigitalCommissionsForUser("pub-1")).toBe(2);
    expect(await reconcilePublisherDigitalCommissionsForUser("pub-1")).toBe(0);
    expect(state.ledger).toHaveLength(2);
    expect(state.balance).toBe(14);
  });
});

describe("isWeeklyAutoInvoicing", () => {
  it("is automatic only with invoicing enabled and the weekly cycle on", () => {
    expect(isWeeklyAutoInvoicing({ enabled: true, weeklyCycle: true })).toBe(true);
    expect(isWeeklyAutoInvoicing({ enabled: true, weeklyCycle: false })).toBe(false);
    expect(isWeeklyAutoInvoicing({ enabled: false, weeklyCycle: true })).toBe(false);
    expect(isWeeklyAutoInvoicing({ enabled: false, weeklyCycle: false })).toBe(false);
  });
});
