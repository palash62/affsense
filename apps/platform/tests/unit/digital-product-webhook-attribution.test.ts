import { beforeEach, describe, expect, it, vi } from "vitest";

const digitalProductFindMany = vi.fn();
const digitalProductClickFindFirst = vi.fn();
const resolvePublisherFromAffiliateRefMock = vi.fn();
const loadDigitalProductCommissionLookupMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    digitalProduct: {
      findMany: (...args: unknown[]) => digitalProductFindMany(...args),
    },
    digitalProductClick: {
      findFirst: (...args: unknown[]) => digitalProductClickFindFirst(...args),
    },
  },
}));

vi.mock("@/services/clickfunnels-webhook-settings.service", () => ({
  resolvePublisherFromAffiliateRef: (...args: unknown[]) =>
    resolvePublisherFromAffiliateRefMock(...args),
}));

vi.mock("@/lib/digital-product-commission", () => ({
  loadDigitalProductCommissionLookup: (...args: unknown[]) =>
    loadDigitalProductCommissionLookupMock(...args),
}));

import { resolveDigitalProductWebhookAttribution } from "@/lib/clickfunnels-webhook-attribution";

describe("resolveDigitalProductWebhookAttribution click enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    digitalProductFindMany.mockResolvedValue([]);
    loadDigitalProductCommissionLookupMock.mockResolvedValue({
      resolve: () => ({
        productId: "prod-1",
        productName: "Affiliate Marketing Mastery",
        pageSlug: "sales",
        amount: 9.99,
        commission: 5,
        matched: "front_end",
        orderType: "Front End",
        upsellId: null,
      }),
    });
  });

  it("copies subId/src/clickId when fallback click matches product", async () => {
    resolvePublisherFromAffiliateRefMock.mockResolvedValue({
      publisherId: null,
      affiliateRef: null,
    });
    digitalProductClickFindFirst.mockResolvedValue({
      id: "click-1",
      publisherId: "pub-1",
      subId: "profile",
      src: "facebook",
    });

    const result = await resolveDigitalProductWebhookAttribution({
      body: {
        purchase: { products: [{ amount_cents: 999 }], status: "paid" },
        data: { visits: { first_visit: { landing_page: "https://x.test/sales" } } },
      },
      at: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      publisherId: "pub-1",
      affiliateRef: "pub-1",
      clickId: "click-1",
      subId: "profile",
      src: "facebook",
    });
    expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: "prod-1" }),
        select: { id: true, publisherId: true, subId: true, src: true },
      }),
    );
  });

  it("attaches tracking params from publisher click when affiliate ref resolves", async () => {
    resolvePublisherFromAffiliateRefMock.mockResolvedValue({
      publisherId: "pub-37",
      affiliateRef: "37e34b6q",
    });
    digitalProductClickFindFirst.mockResolvedValue({
      id: "click-2",
      subId: "profile",
      src: "facebook",
    });

    const result = await resolveDigitalProductWebhookAttribution({
      body: {
        affsense_id: "37e34b6q",
        purchase: { products: [{ amount_cents: 999 }], status: "paid" },
        data: { visits: { first_visit: { landing_page: "https://x.test/sales" } } },
      },
      at: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(result).toEqual({
      publisherId: "pub-37",
      affiliateRef: "37e34b6q",
      clickId: "click-2",
      subId: "profile",
      src: "facebook",
    });
    expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: "prod-1",
          publisherId: "pub-37",
        }),
        select: { id: true, subId: true, src: true },
      }),
    );
  });
});
