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
  eventMeta: new Map<
    string,
    { digitalProductId: string; cfOrderId: string; cfProductId: string | null }
  >(),
}));

const mocks = vi.hoisted(() => {
  const calls: string[] = [];
  const tx = {
    wallet: {
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
      create: vi.fn(async ({ data }: { data: LedgerRow }) => {
        calls.push("ledger.create");
        state.ledger.push(data);
      }),
    },
    webhookEvent: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => state.eventMeta.get(where.id) ?? null),
    },
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      if (sql.includes("FROM wallets")) {
        calls.push("lock.wallet");
        return [{ id: "wallet-1" }];
      }
      if (sql.includes("JOIN webhook_events")) {
        const [refType, eventId, , productId, orderId, cfProductId] = values;
        return state.ledger
          .filter((row) => {
            if (row.referenceType !== refType || row.referenceId === eventId) return false;
            const meta = state.eventMeta.get(row.referenceId);
            return (
              meta !== undefined &&
              meta.digitalProductId === productId &&
              meta.cfOrderId === orderId &&
              meta.cfProductId === cfProductId
            );
          })
          .map(() => ({ id: "entry" }));
      }
      calls.push("lock.ledger");
      return state.ledger
        .filter((row) => row.referenceId === values[0])
        .map(() => ({ id: "entry" }));
    }),
  };

  const prisma = {
    wallet: {
      upsert: vi.fn(async () => ({ id: "wallet-1", userId: "pub-1" })),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      // Run transactions one at a time, like the wallet row lock does.
      const run = mocks.queue.then(() => fn(tx));
      mocks.queue = run.catch(() => undefined);
      return run;
    }),
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

  return { tx, prisma, calls, queue: Promise.resolve() as Promise<unknown> };
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
    state.eventMeta = new Map();
    mocks.calls.length = 0;
  });

  it("takes the wallet lock before any ledger read or write", async () => {
    state.commissions.set("evt-1", { publisherId: "pub-1", commission: 3, isRefund: false });

    await recordDigitalProductCommission("evt-1");

    expect(mocks.calls).toEqual(["lock.wallet", "lock.ledger", "ledger.create"]);
    expect(mocks.prisma.wallet.upsert).toHaveBeenCalledBefore(mocks.prisma.$transaction);
  });

  it("posts each sale once when reconciles start together", async () => {
    state.events = [{ id: "evt-a" }, { id: "evt-b" }];
    state.commissions.set("evt-a", { publisherId: "pub-1", commission: 10, isRefund: false });
    state.commissions.set("evt-b", { publisherId: "pub-1", commission: 4, isRefund: false });

    const [first, second] = await Promise.all([
      reconcilePublisherDigitalCommissionsForUser("pub-1"),
      reconcilePublisherDigitalCommissionsForUser("pub-1"),
    ]);

    expect(first).toBe(2);
    expect(second).toBe(2);
    expect(state.ledger).toHaveLength(2);
    expect(state.balance).toBe(14);
  });

  it("does not double-post when two postings of the same sale race", async () => {
    state.commissions.set("evt-1", { publisherId: "pub-1", commission: 7, isRefund: false });

    const results = await Promise.all([
      recordDigitalProductCommission("evt-1"),
      recordDigitalProductCommission("evt-1"),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(state.ledger).toHaveLength(1);
    expect(state.balance).toBe(7);
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

  it("reverses a refunded order only once when the refund arrives twice", async () => {
    state.balance = 20;
    const order = { digitalProductId: "prod-1", cfOrderId: "6986933", cfProductId: "1037588" };
    state.eventMeta.set("evt-refund-invoice", order);
    state.eventMeta.set("evt-refund-order", order);
    state.commissions.set("evt-refund-invoice", { publisherId: "pub-1", commission: 8.4, isRefund: true });
    state.commissions.set("evt-refund-order", { publisherId: "pub-1", commission: 8.4, isRefund: true });

    expect(await recordDigitalProductCommission("evt-refund-invoice")).toBe(true);
    expect(await recordDigitalProductCommission("evt-refund-order")).toBe(false);

    expect(state.ledger).toHaveLength(1);
    expect(state.balance).toBeCloseTo(11.6);
  });

  it("still reverses a refund of a different product in the same order", async () => {
    state.balance = 20;
    state.eventMeta.set("evt-refund-main", { digitalProductId: "prod-1", cfOrderId: "7001", cfProductId: "cf-main" });
    state.eventMeta.set("evt-refund-upsell", { digitalProductId: "prod-1", cfOrderId: "7001", cfProductId: "cf-upsell" });
    state.commissions.set("evt-refund-main", { publisherId: "pub-1", commission: 5, isRefund: true });
    state.commissions.set("evt-refund-upsell", { publisherId: "pub-1", commission: 3, isRefund: true });

    expect(await recordDigitalProductCommission("evt-refund-main")).toBe(true);
    expect(await recordDigitalProductCommission("evt-refund-upsell")).toBe(true);
    expect(state.balance).toBe(12);
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
