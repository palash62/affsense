import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

const dnsMock = vi.hoisted(() => ({
  resolveCname: vi.fn<() => Promise<string[]>>(),
  resolve4: vi.fn<() => Promise<string[]>>(),
}));

const prismaMock = vi.hoisted(() => ({
  advertiserDomain: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  advertiserOptinPage: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  default: dnsMock,
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/platform-host", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform-host")>();
  return {
    ...actual,
    getPlatformHost: () => "affsense.com",
    isPlatformHost: (host: string) => host === "affsense.com" || host === "www.affsense.com",
  };
});

import {
  addAdvertiserDomain,
  assertVerifiedDomainForAdvertiser,
  resolveFunnelByDomain,
  verifyAdvertiserDomain,
} from "@/services/advertiser-domain.service";

describe("advertiser-domain.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dnsMock.resolveCname.mockRejectedValue(new Error("no cname"));
    dnsMock.resolve4.mockRejectedValue(new Error("no a"));
    prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) {
        await op;
      }
    });
  });

  it("normalizes and validates domain input on add", async () => {
    prismaMock.advertiserDomain.findUnique.mockResolvedValue(null);
    prismaMock.advertiserDomain.upsert.mockResolvedValue({
      id: "dom-1",
      domain: "www.example.com",
      status: "PENDING",
      funnels: [],
    });

    await addAdvertiserDomain("adv-1", "HTTPS://WWW.Example.COM/path");

    expect(prismaMock.advertiserDomain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: "www.example.com" },
        create: expect.objectContaining({ advertiserId: "adv-1", domain: "www.example.com" }),
      }),
    );
  });

  it("rejects platform domains", async () => {
    await expect(addAdvertiserDomain("adv-1", "affsense.com")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("marks domain verified when CNAME points to platform host", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue({
      id: "dom-1",
      advertiserId: "adv-1",
      domain: "www.brand.com",
      status: "PENDING",
    });
    dnsMock.resolveCname.mockResolvedValue(["affsense.com"]);
    prismaMock.advertiserDomain.update.mockResolvedValue({
      id: "dom-1",
      domain: "www.brand.com",
      status: "VERIFIED",
      funnels: [],
    });

    const result = await verifyAdvertiserDomain("adv-1", "dom-1");

    expect(result.status).toBe("VERIFIED");
    expect(prismaMock.advertiserDomain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "VERIFIED" }),
      }),
    );
  });

  it("marks domain failed when DNS does not point to platform", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue({
      id: "dom-1",
      advertiserId: "adv-1",
      domain: "www.brand.com",
      status: "PENDING",
    });
    prismaMock.advertiserDomain.update.mockResolvedValue({
      id: "dom-1",
      domain: "www.brand.com",
      status: "FAILED",
      funnels: [],
    });

    const result = await verifyAdvertiserDomain("adv-1", "dom-1");

    expect(result.status).toBe("FAILED");
  });

  it("resolves only verified domains with a published funnel", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue({
      id: "dom-1",
      domain: "www.brand.com",
      status: "VERIFIED",
      funnels: [{ id: "funnel-1", slug: "sales", advertiserId: "adv-1" }],
    });

    const resolved = await resolveFunnelByDomain("www.brand.com");

    expect(resolved?.funnel.slug).toBe("sales");
    expect(prismaMock.advertiserDomain.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { domain: "www.brand.com", status: "VERIFIED" },
      }),
    );
  });

  it("returns null when domain has no published funnel", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue({
      id: "dom-1",
      domain: "www.brand.com",
      status: "VERIFIED",
      funnels: [],
    });

    const resolved = await resolveFunnelByDomain("www.brand.com");
    expect(resolved).toBeNull();
  });

  it("requires verified domain ownership before linking to funnel", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue(null);

    await expect(assertVerifiedDomainForAdvertiser("adv-1", "dom-1")).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it("detaches domain from other funnels when asserting ownership", async () => {
    prismaMock.advertiserDomain.findFirst.mockResolvedValue({
      id: "dom-1",
      advertiserId: "adv-1",
      domain: "www.brand.com",
      status: "VERIFIED",
    });
    prismaMock.advertiserOptinPage.updateMany.mockResolvedValue({ count: 1 });

    const domain = await assertVerifiedDomainForAdvertiser("adv-1", "dom-1");

    expect(domain?.id).toBe("dom-1");
    expect(prismaMock.advertiserOptinPage.updateMany).toHaveBeenCalledWith({
      where: { customDomainId: "dom-1", advertiserId: "adv-1" },
      data: { customDomainId: null },
    });
  });
});

describe("buildFunnelPublicUrl", () => {
  it("uses custom domain when provided", async () => {
    const { buildFunnelPublicUrl } = await import("@/lib/platform-host");
    expect(
      buildFunnelPublicUrl({
        slug: "sales",
        appUrl: "https://affsense.com",
        customDomain: "www.brand.com",
      }),
    ).toBe("https://www.brand.com");
  });

  it("falls back to platform slug URL", async () => {
    const { buildFunnelPublicUrl } = await import("@/lib/platform-host");
    expect(
      buildFunnelPublicUrl({
        slug: "sales",
        appUrl: "https://affsense.com",
      }),
    ).toBe("https://affsense.com/o/sales");
  });
});
