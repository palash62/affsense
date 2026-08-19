import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  lead: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { listDistinctLeadSources } from "@/services/lead.service";

describe("listDistinctLeadSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns distinct non-null sources with optional search", async () => {
    prismaMock.lead.findMany.mockResolvedValue([
      { source: "vita" },
      { source: "facebook" },
    ]);

    const results = await listDistinctLeadSources({
      search: "vit",
      dateFrom: new Date("2026-07-13"),
      dateTo: new Date("2026-08-12"),
    });

    expect(results).toEqual(["vita", "facebook"]);
    expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: {
            not: null,
            contains: "vit",
          },
        }),
        distinct: ["source"],
        take: 50,
      }),
    );
  });

  it("scopes by advertiser campaign and publisher filters", async () => {
    prismaMock.lead.findMany.mockResolvedValue([]);

    await listDistinctLeadSources({
      advertiserId: "adv-1",
      campaignId: "camp-1",
      publisherId: "pub-1",
      dateFrom: new Date("2026-07-13"),
      dateTo: new Date("2026-08-12"),
    });

    expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaignId: "camp-1",
          publisherId: "pub-1",
          campaign: { advertiserId: "adv-1" },
        }),
      }),
    );
  });
});
