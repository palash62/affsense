import { describe, expect, it } from "vitest";
import {
  buildDigitalProductCommissionLookup,
} from "@/lib/digital-product-commission";
import {
  buildAffiliateParamCandidates,
  extractAffiliateRefFromWebhookPayload,
} from "@/lib/clickfunnels-webhook-attribution";
import { extractPageSlugFromClickFunnelsPayload } from "@/lib/clickfunnels-webhook-payload";
import { dedupeDigitalProductOrderRows, type DigitalProductOrderRow } from "@/services/digital-product.service";

const catalog = buildDigitalProductCommissionLookup({
  products: [
    {
      id: "prod-fe",
      name: "Affiliate Marketing Mastery",
      salesPageUrl: "https://leads.viralfunnelsystem.club/sales",
      price: 2,
      frontEndCommission: 50,
    },
  ],
  upsells: [
    {
      id: "upsell-oto",
      name: "OTO 1",
      pageSlug: "oto",
      price: 17,
      commissionPct: 50,
      productId: "prod-fe",
    },
  ],
});

describe("digital product commission amount-first resolve", () => {
  it("classifies $2.95 as Front End even when page slug is oto", () => {
    const resolved = catalog.resolve("oto", 2.95);
    expect(resolved.matched).toBe("front_end");
    expect(resolved.orderType).toBe("Front End");
    expect(resolved.productName).toBe("Affiliate Marketing Mastery");
    expect(resolved.productId).toBe("prod-fe");
    expect(resolved.upsellId).toBeNull();
    expect(resolved.commission).toBe(1.48); // 2.95 * 50%
  });

  it("classifies $17 as Upsell when slug is oto", () => {
    const resolved = catalog.resolve("oto", 17);
    expect(resolved.matched).toBe("upsell");
    expect(resolved.orderType).toBe("Upsell");
    expect(resolved.productName).toBe("OTO 1");
    expect(resolved.upsellId).toBe("upsell-oto");
    expect(resolved.commission).toBe(8.5);
  });

  it("falls back to upsell slug when amount is null", () => {
    const resolved = catalog.resolve("oto", null);
    expect(resolved.matched).toBe("upsell");
    expect(resolved.orderType).toBe("Upsell");
    expect(resolved.productName).toBe("OTO 1");
  });

  it("falls back to FE slug when amount is null and slug matches sales page", () => {
    const resolved = catalog.resolve("sales", null);
    expect(resolved.matched).toBe("front_end");
    expect(resolved.orderType).toBe("Front End");
  });

  it("picks closer price when both FE and upsell are within tolerance", () => {
    const dual = buildDigitalProductCommissionLookup({
      products: [
        {
          id: "p1",
          name: "FE",
          salesPageUrl: "https://x.test/fe",
          price: 10,
          frontEndCommission: 40,
        },
      ],
      upsells: [
        {
          id: "u1",
          name: "Near",
          pageSlug: "oto",
          price: 10.4,
          commissionPct: 50,
          productId: "p1",
        },
      ],
    });
    // amount 10.3 → closer to upsell 10.4 (diff 0.1) than FE 10 (diff 0.3)
    const resolved = dual.resolve("oto", 10.3);
    expect(resolved.matched).toBe("upsell");
    expect(resolved.productName).toBe("Near");
  });
});

describe("clickfunnels page slug prefers first_visit", () => {
  it("uses first_visit path over last_visit oto", () => {
    const slug = extractPageSlugFromClickFunnelsPayload({
      data: {
        visits: {
          last_visit: {
            landing_page: "https://leads.viralfunnelsystem.club/oto",
          },
          first_visit: {
            landing_page: "https://leads.viralfunnelsystem.club/sales?affsense_id=pub1",
          },
        },
      },
    });
    expect(slug).toBe("sales");
  });
});

describe("affiliate ref extraction", () => {
  it("builds unique param candidates with aliases", () => {
    expect(buildAffiliateParamCandidates("affsense_id", ["aff_id", "affsense_id"])).toEqual([
      "affsense_id",
      "aff_id",
      "pub_id",
    ]);
  });

  it("reads affsense_id from first_visit when last_visit has none", () => {
    const ref = extractAffiliateRefFromWebhookPayload(
      {
        data: {
          visits: {
            last_visit: { landing_page: "https://leads.viralfunnelsystem.club/oto" },
            first_visit: {
              landing_page: "https://leads.viralfunnelsystem.club/sales?affsense_id=pub-abc",
            },
          },
        },
      },
      "affsense_id",
    );
    expect(ref).toBe("pub-abc");
  });

  it("accepts pub_id alias", () => {
    const ref = extractAffiliateRefFromWebhookPayload(
      {
        data: {
          visits: {
            first_visit: {
              landing_page: "https://example.com/x?pub_id=pub-9",
            },
          },
        },
      },
      "affsense_id",
    );
    expect(ref).toBe("pub-9");
  });
});

describe("dedupeDigitalProductOrderRows", () => {
  function row(partial: Partial<DigitalProductOrderRow> & Pick<DigitalProductOrderRow, "id" | "orderId">): DigitalProductOrderRow {
    return {
      date: "2026-09-09T12:00:00.000Z",
      customerEmail: null,
      customerName: null,
      product: null,
      funnel: null,
      orderType: null,
      amount: null,
      commission: null,
      affiliateName: null,
      affiliateEmail: null,
      affiliateRef: null,
      source: null,
      subId: null,
      eventType: "purchase",
      webhookStatus: "PROCESSED",
      paymentStatus: null,
      ...partial,
    };
  }

  it("keeps one row per orderId preferring attributed PROCESSED", () => {
    const items = dedupeDigitalProductOrderRows([
      row({
        id: "a",
        orderId: "8278",
        date: "2026-09-09T12:01:00.000Z",
        webhookStatus: "FAILED",
      }),
      row({
        id: "b",
        orderId: "8278",
        date: "2026-09-09T12:00:00.000Z",
        webhookStatus: "PROCESSED",
        affiliateName: "Pub",
        affiliateRef: "pub-1",
      }),
      row({
        id: "c",
        orderId: "8279",
        date: "2026-09-09T11:00:00.000Z",
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(items.find((r) => r.orderId === "8278")?.id).toBe("b");
  });
});
