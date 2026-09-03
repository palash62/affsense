import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listPublisherCpaOffers,
  publisherCanPromoteCpaOffer,
  requestPublisherCpaOfferAccess,
  reviewCpaOfferAccessRequest,
} from "@/services/cpa-offer.service";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cpaOffer: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    publisherCpaOfferAccess: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const baseOffer = {
  id: "offer1",
  name: "Private Offer",
  network: "Direct",
  category: "Finance",
  country: "US",
  previewUrl: "https://example.com/p",
  trackingUrl: "https://example.com/t",
  thumbnailUrl: null,
  advertiserLabel: "Platform",
  description: null,
  details: null,
  createdByUserId: null,
  revenueModel: "RPA",
  payoutModel: "CPA",
  payoutType: "FLAT",
  revenue: { toString: () => "10.00" },
  payout: { toString: () => "5.00" },
  status: "ACTIVE" as const,
  postbackToken: "tok",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("publisher CPA offer access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("public offers are promotable without access row", async () => {
    vi.mocked(prisma.cpaOffer.count).mockResolvedValue(1);
    vi.mocked(prisma.cpaOffer.findMany).mockResolvedValue([
      { ...baseOffer, visibility: "PUBLIC" },
    ] as never);
    vi.mocked(prisma.publisherCpaOfferAccess.findMany).mockResolvedValue([]);

    const result = await listPublisherCpaOffers("pub1", { page: 1, limit: 20 });

    expect(result.items[0]?.canPromote).toBe(true);
    expect(result.items[0]?.accessStatus).toBeNull();
  });

  it("private offers require approved access", async () => {
    vi.mocked(prisma.cpaOffer.count).mockResolvedValue(1);
    vi.mocked(prisma.cpaOffer.findMany).mockResolvedValue([
      { ...baseOffer, visibility: "PRIVATE" },
    ] as never);
    vi.mocked(prisma.publisherCpaOfferAccess.findMany).mockResolvedValue([
      { offerId: "offer1", status: "PENDING", adminNote: null },
    ] as never);

    const result = await listPublisherCpaOffers("pub1", { page: 1, limit: 20 });

    expect(result.items[0]?.canPromote).toBe(false);
    expect(result.items[0]?.accessStatus).toBe("PENDING");
  });

  it("publisherCanPromoteCpaOffer returns false for private without approval", async () => {
    vi.mocked(prisma.cpaOffer.findFirst).mockResolvedValue({
      id: "offer1",
      visibility: "PRIVATE",
    } as never);
    vi.mocked(prisma.publisherCpaOfferAccess.findUnique).mockResolvedValue({
      status: "PENDING",
    } as never);

    await expect(publisherCanPromoteCpaOffer("pub1", "offer1")).resolves.toBe(false);
  });

  it("requestPublisherCpaOfferAccess upserts pending row", async () => {
    vi.mocked(prisma.cpaOffer.findFirst).mockResolvedValue({
      id: "offer1",
      name: "Private Offer",
    } as never);
    vi.mocked(prisma.publisherCpaOfferAccess.upsert).mockResolvedValue({
      id: "access1",
      offerId: "offer1",
      status: "PENDING",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
    } as never);

    const result = await requestPublisherCpaOfferAccess("pub1", "offer1");

    expect(result.status).toBe("PENDING");
    expect(prisma.publisherCpaOfferAccess.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "PENDING", adminNote: null }),
      }),
    );
  });

  it("reviewCpaOfferAccessRequest requires note on reject", async () => {
    vi.mocked(prisma.publisherCpaOfferAccess.findUnique).mockResolvedValue({
      id: "access1",
      status: "PENDING",
      offer: { visibility: "PRIVATE" },
    } as never);

    await expect(
      reviewCpaOfferAccessRequest("admin1", "access1", "REJECTED"),
    ).rejects.toThrow("A rejection note is required");
  });
});
