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

  it("does not attribute a sale without an affiliate ref to a recent clicker", async () => {
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
      publisherId: null,
      affiliateRef: null,
      clickId: null,
      subId: null,
      subId2: null,
      subId3: null,
      subId4: null,
      src: null,
    });
    expect(digitalProductClickFindFirst).not.toHaveBeenCalled();
  });

  it("uses the mapped productId for click enrichment instead of the catalog lookup", async () => {
    resolvePublisherFromAffiliateRefMock.mockResolvedValue({
      publisherId: "pub-37",
      affiliateRef: "37e34b6q",
    });
    digitalProductClickFindFirst.mockResolvedValue(null);

    const result = await resolveDigitalProductWebhookAttribution({
      body: { affsense_id: "37e34b6q", purchase: { products: [{ amount_cents: 995 }] } },
      at: new Date("2026-09-10T12:00:00.000Z"),
      productId: "prod-mapped",
    });

    expect(result.publisherId).toBe("pub-37");
    expect(result.clickId).toBeNull();
    expect(loadDigitalProductCommissionLookupMock).not.toHaveBeenCalled();
    expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: "prod-mapped", publisherId: "pub-37" }),
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
      subId2: null,
      subId3: null,
      subId4: null,
      src: "facebook",
    });
    expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          productId: "prod-1",
          publisherId: "pub-37",
        }),
        select: { id: true, subId: true, subId2: true, subId3: true, subId4: true, src: true },
      }),
    );
  });

  describe("exact visit attribution", () => {
    const at = new Date("2026-09-10T12:00:00.000Z");
    const landing = (query: string) => ({
      purchase: { products: [{ amount_cents: 999 }], status: "paid" },
      data: {
        visits: { first_visit: { landing_page: `https://x.test/sales?affsense_id=AFF100003&${query}` } },
      },
    });

    beforeEach(() => {
      resolvePublisherFromAffiliateRefMock.mockResolvedValue({
        publisherId: "pub-1",
        affiliateRef: "AFF100003",
      });
    });

    it("uses the exact aff_click click over a newer click with another sub id", async () => {
      digitalProductClickFindFirst.mockImplementation(async (args: { where: { id?: string } }) =>
        args.where.id === "click-fb"
          ? { id: "click-fb", subId: "fb", src: "facebook" }
          : { id: "click-yt", subId: "yt", src: "youtube" },
      );

      const result = await resolveDigitalProductWebhookAttribution({
        body: landing("subid=fb&source=facebook&aff_click=click-fb"),
        at,
      });

      expect(result).toMatchObject({ clickId: "click-fb", subId: "fb", src: "facebook" });
      expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "click-fb", publisherId: "pub-1", productId: "prod-1" },
        }),
      );
    });

    it("ignores an aff_click that does not belong to this publisher and uses the visit sub id", async () => {
      digitalProductClickFindFirst.mockImplementation(async (args: { where: { id?: string; subId?: string } }) => {
        if (args.where.id) return null;
        return args.where.subId === "fb" ? { id: "click-fb-2", subId: "fb", src: "facebook" } : null;
      });

      const result = await resolveDigitalProductWebhookAttribution({
        body: landing("subid=fb&source=facebook&aff_click=someone-else"),
        at,
      });

      expect(result).toMatchObject({ clickId: "click-fb-2", subId: "fb", src: "facebook" });
    });

    it("prefers landing URL subid/source over the latest click", async () => {
      digitalProductClickFindFirst.mockResolvedValue(null);

      const result = await resolveDigitalProductWebhookAttribution({
        body: landing("subid=fb&source=facebook"),
        at,
      });

      expect(result).toMatchObject({ clickId: null, subId: "fb", src: "facebook" });
      expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subId: "fb", src: "facebook" }),
        }),
      );
    });

    it("carries sub2-sub4 from the exact aff_click click", async () => {
      digitalProductClickFindFirst.mockResolvedValue({
        id: "click-fb",
        subId: "fb",
        subId2: "adset1",
        subId3: "creative9",
        subId4: "geo_us",
        src: "facebook",
      });

      const result = await resolveDigitalProductWebhookAttribution({
        body: landing("subid=fb&aff_click=click-fb"),
        at,
      });

      expect(result).toMatchObject({ clickId: "click-fb", subId: "fb", subId2: "adset1", subId3: "creative9", subId4: "geo_us" });
    });

    it("reads sub2-sub4 from the landing URL and filters the fallback click by them", async () => {
      digitalProductClickFindFirst.mockResolvedValue(null);

      const result = await resolveDigitalProductWebhookAttribution({
        body: landing("sub1=fb&sub2=adset1&subid3=creative9&sub4=geo_us"),
        at,
      });

      expect(result).toMatchObject({ clickId: null, subId: "fb", subId2: "adset1", subId3: "creative9", subId4: "geo_us" });
      expect(digitalProductClickFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subId: "fb", subId2: "adset1", subId3: "creative9", subId4: "geo_us" }),
        }),
      );
    });

    it("falls back to the latest click when the visit has no tracking params", async () => {
      digitalProductClickFindFirst.mockResolvedValue({ id: "click-yt", subId: "yt", src: "youtube" });

      const result = await resolveDigitalProductWebhookAttribution({ body: landing("x=1"), at });

      expect(result).toMatchObject({ clickId: "click-yt", subId: "yt", src: "youtube" });
    });
  });
});
