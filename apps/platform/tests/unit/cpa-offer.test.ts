import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { buildGlobalCpaPostbackUrl, buildCpaOfferTrackingUrl, resolveCpaOfferRedirectUrl } from "@cpl/shared";
import {
  serializeCpaOffer,
  listActiveCpaOffers,
  listCpaOffersForAdmin,
} from "@/services/cpa-offer.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cpaOffer: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

describe("buildGlobalCpaPostbackUrl", () => {
  it("builds network-wide postback URL with macros (no offer token)", () => {
    const url = buildGlobalCpaPostbackUrl("https://leadgenlink.site");
    expect(url).toBe(
      "https://leadgenlink.site/pbtr?click_id={click_id}&payout={payout}",
    );
  });
});

describe("buildCpaOfferTrackingUrl", () => {
  it("builds platform redirect URL with advertiser and optional params", () => {
    const url = buildCpaOfferTrackingUrl(
      "offer1",
      { advertiserId: "adv-9", src: "facebook", subId: "camp-a" },
      "https://leadgenlink.site",
    );
    expect(url).toContain("https://leadgenlink.site/cpa/offer1?");
    expect(url).toContain("adv_id=adv-9");
    expect(url).toContain("src=facebook");
    expect(url).toContain("sub_id=camp-a");
  });

  it("includes lead_id when provided", () => {
    const url = buildCpaOfferTrackingUrl(
      "offer1",
      { advertiserId: "adv-9", leadId: "lead-abc" },
      "https://leadgenlink.site",
    );
    expect(url).toContain("lead_id=lead-abc");
  });
});

describe("resolveCpaOfferRedirectUrl", () => {
  it("delegates to buildCpaOfferTrackingUrl", () => {
    const url = resolveCpaOfferRedirectUrl(
      "offer42",
      { advertiserId: "adv-1", src: "email" },
      "https://track.example.com",
    );
    expect(url).toBe(
      buildCpaOfferTrackingUrl(
        "offer42",
        { advertiserId: "adv-1", src: "email" },
        "https://track.example.com",
      ),
    );
  });
});

describe("serializeCpaOffer", () => {
  it("includes marketplace fields without exposing per-offer postback URL", () => {
    const prev = process.env.TRACKING_URL;
    process.env.TRACKING_URL = "https://leadgenlink.site";
    try {
      const serialized = serializeCpaOffer({
        id: "offer1",
        name: "Test Offer",
        network: "Net",
        category: "Finance",
        country: "US, CA",
        previewUrl: "https://example.com/p",
        trackingUrl: "https://example.com/t",
        thumbnailUrl: "https://example.com/thumb.jpg",
        advertiserLabel: "Cash Network",
        revenueModel: "RPA",
        payoutModel: "CPA",
        payoutType: "FLAT",
        revenue: { toString: () => "20.00" } as never,
        payout: { toString: () => "12.50" } as never,
        status: "ACTIVE",
        postbackToken: "tok_xyz",
        description: null,
        details: null,
        createdByUserId: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      expect(serialized.payout).toBe("12.50");
      expect(serialized.revenue).toBe("20.00");
      expect(serialized.advertiserLabel).toBe("Cash Network");
      expect(serialized.revenueModel).toBe("RPA");
      expect(serialized.payoutModel).toBe("CPA");
      expect(serialized.payoutType).toBe("FLAT");
      expect(serialized.thumbnailUrl).toBe("https://example.com/thumb.jpg");
      expect(serialized.postbackToken).toBe("tok_xyz");
      expect(serialized).not.toHaveProperty("postbackUrl");
    } finally {
      process.env.TRACKING_URL = prev;
    }
  });
});

describe("cpa offer list visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("advertiser list forces ACTIVE status filter", async () => {
    vi.mocked(prisma.cpaOffer.count).mockResolvedValue(0);
    vi.mocked(prisma.cpaOffer.findMany).mockResolvedValue([]);

    await listActiveCpaOffers({ page: 1, limit: 20, status: "PAUSED" });

    expect(prisma.cpaOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
      }),
    );
  });

  it("admin list respects explicit status filter", async () => {
    vi.mocked(prisma.cpaOffer.count).mockResolvedValue(0);
    vi.mocked(prisma.cpaOffer.findMany).mockResolvedValue([]);

    await listCpaOffersForAdmin({ page: 1, limit: 20, status: "PAUSED" });

    expect(prisma.cpaOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PAUSED" }),
      }),
    );
  });
});
