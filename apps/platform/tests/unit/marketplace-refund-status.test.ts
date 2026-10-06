import { describe, expect, it, vi } from "vitest";

type Event = {
  id: string;
  eventType: string;
  status: string;
  publisherId: string | null;
  digitalProductId: string | null;
  cfOrderId: string | null;
  cfProductId: string | null;
  externalEventKey: string | null;
  commissionAmount: number | null;
  commissionRate: number | null;
  digitalCommissionPlanId: string | null;
  payloadJson: unknown;
  createdAt: Date;
};

function event(overrides: Partial<Event> & Pick<Event, "id" | "eventType">): Event {
  return {
    status: "PROCESSED",
    publisherId: "pub-1",
    digitalProductId: "prod-pcm",
    cfOrderId: "6986933",
    cfProductId: "1037588",
    externalEventKey: null,
    commissionAmount: 8.4,
    commissionRate: 70,
    digitalCommissionPlanId: null,
    payloadJson: { data: { order_id: 6986933, total_amount: "12.00", order: { order_number: "#8312" } } },
    createdAt: new Date("2026-09-30T18:00:23.000Z"),
    ...overrides,
  };
}

const events: Event[] = [
  event({
    id: "refund-invoice",
    eventType: "orders/invoice.refunded",
    externalEventKey: "cf:refund:6986933:1037588",
    createdAt: new Date("2026-10-06T08:38:52.000Z"),
  }),
  event({ id: "sale", eventType: "orders/invoice.paid", externalEventKey: "cf:order:6986933:1037588" }),
  event({
    id: "other-sale",
    eventType: "orders/invoice.paid",
    cfOrderId: "6986941",
    externalEventKey: "cf:order:6986941:1037590",
    cfProductId: "1037590",
    commissionAmount: 18.5,
    payloadJson: { data: { order_id: 6986941, total_amount: "37.00", order: { order_number: "#8313" } } },
    createdAt: new Date("2026-09-30T18:01:04.000Z"),
  }),
];

const prisma = vi.hoisted(() => ({
  webhookEvent: { findMany: vi.fn() },
  digitalProduct: { findMany: vi.fn(async () => []) },
  digitalProductUpsell: { findMany: vi.fn(async () => []) },
}));

prisma.webhookEvent.findMany.mockImplementation(
  async ({ where }: { where: { OR?: unknown[]; status?: unknown } }) => {
    const isRefundLookup = (where.OR ?? []).some(
      (clause) => typeof clause === "object" && clause !== null && "externalEventKey" in clause,
    );
    if (isRefundLookup) {
      return events.filter(
        (e) => e.status === "PROCESSED" && (e.externalEventKey ?? "").startsWith("cf:refund:"),
      );
    }
    return [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
);

vi.mock("@cpl/database", () => ({ prisma }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import {
  getPublisherCommissionReport,
  listDigitalProductOrders,
  listPublisherDigitalProductOrders,
  REFUNDED_WEBHOOK_STATUS,
} from "@/services/digital-product.service";

describe("refunded marketplace sales", () => {
  it("shows the refunded sale as REFUNDED with no commission in the Report Log", async () => {
    const result = await listPublisherDigitalProductOrders("pub-1");
    const sale = result.items.find((row) => row.id === "sale");
    expect(sale?.webhookStatus).toBe(REFUNDED_WEBHOOK_STATUS);
    expect(sale?.commission).toBe(0);
    expect(result.items.find((row) => row.id === "other-sale")?.webhookStatus).toBe("PROCESSED");
  });

  it("hides refund events from publishers", async () => {
    const result = await listPublisherDigitalProductOrders("pub-1");
    expect(result.items.map((row) => row.id)).not.toContain("refund-invoice");
  });

  it("keeps refund events for admins but never shows them as earned commission", async () => {
    const result = await listDigitalProductOrders({ publisherId: "pub-1" });
    const refund = result.items.find((row) => row.id === "refund-invoice");
    expect(refund).toBeDefined();
    expect(refund?.commission).toBe(0);
    expect(result.summary.totalCommissions).toBeCloseTo(18.5);
  });

  it("leaves the refunded sale out of the commission report total", async () => {
    const report = await getPublisherCommissionReport({ publisherId: "pub-1" });
    expect(report.kpis.commission).toBeCloseTo(18.5);
    expect(report.items.map((row) => row.id)).not.toContain("refund-invoice");
    const sale = report.items.find((row) => row.id === "sale");
    expect(sale?.webhookStatus).toBe(REFUNDED_WEBHOOK_STATUS);

    const refunded = await getPublisherCommissionReport({ publisherId: "pub-1", status: "refunded" });
    expect(refunded.items.map((row) => row.id)).toEqual(["sale"]);
    const approved = await getPublisherCommissionReport({ publisherId: "pub-1", status: "approved" });
    expect(approved.items.map((row) => row.id)).toEqual(["other-sale"]);
  });
});
