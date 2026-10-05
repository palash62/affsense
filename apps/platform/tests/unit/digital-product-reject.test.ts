import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $queryRaw: vi.fn(async () => []),
  webhookEvent: { findMany: vi.fn(), updateMany: vi.fn() },
  ledgerEntry: { count: vi.fn(async () => 0) },
  auditLog: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhookEvent: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));

vi.mock("@/services/wallet.service", () => ({
  DIGITAL_PRODUCT_REFUND_REFERENCE: "digital_product_refund",
  reverseDigitalProductSaleCommissions: vi.fn(async () => 12.5),
}));

import { prisma } from "@/lib/prisma";
import { reverseDigitalProductSaleCommissions } from "@/services/wallet.service";
import { rejectDigitalProductConversion } from "@/services/digital-product-reject.service";

const sale = (id: string, orderId = 5001) => ({
  id,
  status: "PROCESSED",
  publisherId: "pub-1",
  digitalProductId: "prod-1",
  cfOrderId: String(orderId),
  cfProductId: "cf-1",
  payloadJson: { event_type: "order.completed", data: { order: { id: orderId } } },
});

const findUnique = prisma.webhookEvent.findUnique as unknown as ReturnType<typeof vi.fn>;

describe("rejectDigitalProductConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.ledgerEntry.count.mockResolvedValue(0);
    tx.webhookEvent.updateMany.mockImplementation(async (args: { where: { id: { in: string[] } } }) => ({
      count: args.where.id.in.length,
    }));
  });

  it("rejects every approved copy of the order and reverses the commission once", async () => {
    findUnique.mockResolvedValue(sale("ev-1"));
    tx.webhookEvent.findMany.mockResolvedValue([
      sale("ev-1"),
      sale("ev-2"),
      { ...sale("ev-3"), status: "IGNORED" },
      { ...sale("ev-4"), cfProductId: "cf-upsell" },
    ]);

    const result = await rejectDigitalProductConversion("ev-1", "admin-1", "  Fraud order  ");

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.rejectedEventIds.sort()).toEqual(["ev-1", "ev-2"]);
    expect(result.reversedAmount).toBe(12.5);
    expect(tx.webhookEvent.updateMany).toHaveBeenCalledWith({
      where: { id: { in: expect.arrayContaining(["ev-1", "ev-2"]) }, status: "PROCESSED" },
      data: { status: "REJECTED", errorMessage: "Rejected by admin: Fraud order" },
    });
    expect(reverseDigitalProductSaleCommissions).toHaveBeenCalledWith(
      tx,
      "pub-1",
      expect.arrayContaining(["ev-1", "ev-2"]),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "admin-1",
        action: "digital_product_conversion.rejected",
        entityId: "ev-1",
        metadata: expect.objectContaining({ reason: "Fraud order", reversedAmount: 12.5 }),
      }),
    });
  });

  it("refuses a conversion that is not approved", async () => {
    findUnique.mockResolvedValue({ ...sale("ev-1"), status: "REJECTED" });
    await expect(rejectDigitalProductConversion("ev-1", "admin-1", "Fraud")).rejects.toThrow(
      "Only approved conversions can be rejected",
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses a refund event", async () => {
    findUnique.mockResolvedValue({
      ...sale("ev-r"),
      payloadJson: { event_type: "order.refunded", data: { order: { id: 5001 } } },
    });
    await expect(rejectDigitalProductConversion("ev-r", "admin-1", "Fraud")).rejects.toThrow(
      "Refund events cannot be rejected",
    );
  });

  it("refuses an order whose refund already reversed the commission", async () => {
    findUnique.mockResolvedValue(sale("ev-1"));
    tx.webhookEvent.findMany.mockResolvedValue([
      sale("ev-1"),
      { ...sale("ev-r"), payloadJson: { event_type: "order.refunded", data: { order: { id: 5001 } } } },
    ]);
    tx.ledgerEntry.count.mockResolvedValue(1);

    await expect(rejectDigitalProductConversion("ev-1", "admin-1", "Fraud")).rejects.toThrow(
      "already refunded",
    );
    expect(tx.webhookEvent.updateMany).not.toHaveBeenCalled();
    expect(reverseDigitalProductSaleCommissions).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    await expect(rejectDigitalProductConversion("ev-1", "admin-1", " ")).rejects.toThrow(
      "Rejection reason is required",
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
