import { beforeEach, describe, expect, it, vi } from "vitest";

const webhookEventFindUnique = vi.fn();
const publisherPostbackFindMany = vi.fn();
const digitalDeliveryFindUnique = vi.fn();
const digitalDeliveryUpsert = vi.fn();
const cpaDeliveryUpsert = vi.fn();
const platformSettingFindUnique = vi.fn();
const advertiserGlobalPostbackFindUnique = vi.fn();

const prismaMock = {
  webhookEvent: { findUnique: (...args: unknown[]) => webhookEventFindUnique(...args) },
  publisherPostback: { findMany: (...args: unknown[]) => publisherPostbackFindMany(...args) },
  digitalProductPostbackDelivery: {
    findUnique: (...args: unknown[]) => digitalDeliveryFindUnique(...args),
    upsert: (...args: unknown[]) => digitalDeliveryUpsert(...args),
  },
  cpaPostbackDelivery: { upsert: (...args: unknown[]) => cpaDeliveryUpsert(...args) },
  platformSetting: { findUnique: (...args: unknown[]) => platformSettingFindUnique(...args) },
  advertiserGlobalPostback: {
    findUnique: (...args: unknown[]) => advertiserGlobalPostbackFindUnique(...args),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@cpl/database", () => ({ prisma: prismaMock }));

vi.mock("@cpl/tracking-core", () => ({
  assertSafeOutboundUrl: async (url: string) => new URL(url),
}));
vi.mock("../../../../packages/tracking-core/src/safe-outbound-url", () => ({
  assertSafeOutboundUrl: async (url: string) => new URL(url),
}));

vi.mock("@/lib/clickfunnels-webhook-payload", () => ({
  extractOrderFieldsFromClickFunnelsPayload: (payload: { orderType?: string }) => ({
    orderId: "order-1",
    orderType: payload?.orderType ?? "purchase",
    amount: 100,
    product: "Course",
    source: "fb",
    subId: null,
    pageSlug: "course",
  }),
}));

vi.mock("@/lib/digital-product-commission", () => ({
  DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE: 0.5,
  loadDigitalProductCommissionLookup: async () => ({
    resolve: () => ({ commission: 40, productId: "prod-1" }),
  }),
  applyDigitalCommissionSnapshot: (resolved: unknown) => resolved,
}));

const saleEvent = {
  id: "evt-1",
  status: "PROCESSED",
  eventType: "order.completed",
  publisherId: "pub-1",
  subId: "s1",
  subId2: null,
  subId3: null,
  subId4: null,
  src: null,
  payloadJson: {},
  commissionAmount: null,
  commissionRate: null,
  digitalCommissionPlanId: null,
};

const twoPostbacks = [
  { id: "pb-a", endpoint: "https://a.example/pb?cid={click_id}&p={payout}" },
  { id: "pb-b", endpoint: "https://b.example/pb?cid={click_id}" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, text: async () => "ok" }));
  webhookEventFindUnique.mockResolvedValue(saleEvent);
  publisherPostbackFindMany.mockResolvedValue(twoPostbacks);
  digitalDeliveryFindUnique.mockResolvedValue(null);
  digitalDeliveryUpsert.mockResolvedValue({});
  cpaDeliveryUpsert.mockResolvedValue({});
  platformSettingFindUnique.mockResolvedValue(null);
  advertiserGlobalPostbackFindUnique.mockResolvedValue(null);
});

describe("dispatchDigitalProductPublisherPostback", () => {
  it("fires every active postback once and records one delivery per postback", async () => {
    const { dispatchDigitalProductPublisherPostback } = await import(
      "@/services/digital-product-postback-dispatch"
    );
    const results = await dispatchDigitalProductPublisherPostback("evt-1");

    expect(publisherPostbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publisherId: "pub-1", channel: "DIGITAL_PRODUCT", status: "ACTIVE" },
      }),
    );
    expect(results).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith("https://a.example/pb?cid=order-1&p=40", expect.anything());
    expect(fetch).toHaveBeenCalledWith("https://b.example/pb?cid=order-1", expect.anything());
    const keys = digitalDeliveryUpsert.mock.calls.map(
      ([arg]) => (arg as { where: { webhookEventId_postbackId: unknown } }).where.webhookEventId_postbackId,
    );
    expect(keys).toEqual([
      { webhookEventId: "evt-1", postbackId: "pb-a" },
      { webhookEventId: "evt-1", postbackId: "pb-b" },
    ]);
  });

  it("does not fire a postback again once it has a delivery", async () => {
    digitalDeliveryFindUnique.mockImplementation(async ({ where }) =>
      where.webhookEventId_postbackId.postbackId === "pb-a"
        ? { url: "https://a.example/pb", status: "SUCCESS", httpStatus: 200, error: null }
        : null,
    );
    const { dispatchDigitalProductPublisherPostback } = await import(
      "@/services/digital-product-postback-dispatch"
    );
    const results = await dispatchDigitalProductPublisherPostback("evt-1");

    expect(results?.[0]).toMatchObject({ skipped: true, reason: "already-delivered" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("https://b.example/pb?cid=order-1", expect.anything());
  });

  it("returns null when no postback is active", async () => {
    publisherPostbackFindMany.mockResolvedValue([]);
    const { dispatchDigitalProductPublisherPostback } = await import(
      "@/services/digital-product-postback-dispatch"
    );
    expect(await dispatchDigitalProductPublisherPostback("evt-1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips refunds", async () => {
    webhookEventFindUnique.mockResolvedValue({ ...saleEvent, payloadJson: { orderType: "refund" } });
    const { dispatchDigitalProductPublisherPostback } = await import(
      "@/services/digital-product-postback-dispatch"
    );
    const results = await dispatchDigitalProductPublisherPostback("evt-1");
    expect(results?.[0]).toMatchObject({ skipped: true, reason: "refund" });
    expect(publisherPostbackFindMany).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps firing the rest when one postback fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ status: 500, text: async () => "boom" })
        .mockResolvedValueOnce({ status: 200, text: async () => "ok" }),
    );
    const { dispatchDigitalProductPublisherPostback } = await import(
      "@/services/digital-product-postback-dispatch"
    );
    const results = await dispatchDigitalProductPublisherPostback("evt-1");
    expect(results?.map((r) => r.ok)).toEqual([false, true]);
  });
});

describe("dispatchCpaConversionPostbacks publisher postbacks", () => {
  it("fires each active CPA postback and keys deliveries by postback", async () => {
    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );
    await dispatchCpaConversionPostbacks({
      conversionId: "conv-1",
      offerId: "offer-1",
      advertiserId: null,
      publisherId: "pub-1",
      clickId: "click-1",
      payout: 2,
    });

    expect(publisherPostbackFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publisherId: "pub-1", channel: "CPA", status: "ACTIVE" } }),
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    const keys = cpaDeliveryUpsert.mock.calls.map(
      ([arg]) => (arg as { where: { conversionId_target_postbackId: unknown } }).where.conversionId_target_postbackId,
    );
    expect(keys).toEqual([
      { conversionId: "conv-1", target: "PUBLISHER", postbackId: "pb-a" },
      { conversionId: "conv-1", target: "PUBLISHER", postbackId: "pb-b" },
    ]);
  });

  it("keeps the admin parallel delivery keyed with an empty postback id", async () => {
    platformSettingFindUnique.mockResolvedValue({
      value: { parallelPostbackUrl: "https://admin.example/pb?cid={click_id}" },
    });
    publisherPostbackFindMany.mockResolvedValue([]);
    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );
    await dispatchCpaConversionPostbacks({
      conversionId: "conv-2",
      offerId: "offer-1",
      advertiserId: null,
      publisherId: "pub-1",
      clickId: "click-2",
      payout: 2,
    });

    expect(cpaDeliveryUpsert).toHaveBeenCalledTimes(1);
    expect(cpaDeliveryUpsert.mock.calls[0]![0]).toMatchObject({
      where: {
        conversionId_target_postbackId: {
          conversionId: "conv-2",
          target: "ADMIN_PARALLEL",
          postbackId: "",
        },
      },
    });
  });
});
