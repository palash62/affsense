import { beforeEach, describe, expect, it, vi } from "vitest";
import { substitutePostbackMacros } from "@cpl/shared";
import { publisherPostbackSchema } from "@/lib/validations";
import { buildPublisherPostbackMacroContext } from "@/services/publisher-postback-dispatch";
import { assertHttpTemplateUrl } from "@/services/publisher-postback.service";

const publisherPostbackFindFirst = vi.fn();
const publisherPostbackCreate = vi.fn();
const publisherPostbackUpdate = vi.fn();
const publisherPostbackDelete = vi.fn();
const deliveryFindUnique = vi.fn();
const deliveryCreate = vi.fn();
const deliveryUpdate = vi.fn();
const leadFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publisherPostback: {
      findFirst: (...args: unknown[]) => publisherPostbackFindFirst(...args),
      create: (...args: unknown[]) => publisherPostbackCreate(...args),
      update: (...args: unknown[]) => publisherPostbackUpdate(...args),
      delete: (...args: unknown[]) => publisherPostbackDelete(...args),
    },
    publisherPostbackDelivery: {
      findUnique: (...args: unknown[]) => deliveryFindUnique(...args),
      create: (...args: unknown[]) => deliveryCreate(...args),
      update: (...args: unknown[]) => deliveryUpdate(...args),
    },
    lead: {
      findUnique: (...args: unknown[]) => leadFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/platform-settings-server", () => ({
  getPlatformSettingsConfig: vi.fn().mockResolvedValue({
    publisherPayoutPercent: 70,
    minPayoutAmount: 50,
    minPayoutWise: 50,
    minPayoutBankTransfer: 100,
    minPayoutStripeConnect: 50,
    tier1: { min: 0.7, max: 2.5 },
    tier2: { min: 0.5, max: 1.8 },
    tier3: { min: 0.25, max: 1.0 },
    globalLinkUrl: null,
    duplicateWindowDays: 30,
  }),
}));

const assertSafeOutboundUrl = vi.fn(async (url: string) => new URL(url));
vi.mock("@cpl/tracking-core", () => ({
  assertSafeOutboundUrl: (url: string) => assertSafeOutboundUrl(url),
}));

describe("publisher postback validation", () => {
  it("accepts an S2S payload with macros", () => {
    const parsed = publisherPostbackSchema.safeParse({
      status: "ACTIVE",
      endpoint: "https://track.example.com/pb?click_id={click_id}&payout={payout}",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-http template URL", () => {
    expect(() => assertHttpTemplateUrl("ftp://example.com/pb")).toThrow(/http:\/\/ or https:\/\//);
  });

  it("accepts macros inside a valid https URL", () => {
    expect(() =>
      assertHttpTemplateUrl("https://track.example.com/pb?click_id={click_id}"),
    ).not.toThrow();
  });
});

describe("publisher postback macros", () => {
  it("substitutes click_id, lead_id, payout, and sub_id", () => {
    const context = buildPublisherPostbackMacroContext({
      leadId: "lead-99",
      publisherId: "pub-1",
      campaignId: "camp-1",
      payout: 0.7,
      source: "facebook",
      subId: "sub-a",
      date: "2026-08-17",
    });
    const url = substitutePostbackMacros(
      "https://tracker.example/pb?click_id={click_id}&lead_id={lead_id}&payout={payout}&sub_id={sub_id}&sub1={sub1}&aff_id={aff_id}&offer_id={offer_id}&source={source}",
      context,
    );
    expect(url).toBe(
      "https://tracker.example/pb?click_id=lead-99&lead_id=lead-99&payout=0.7&sub_id=sub-a&sub1=sub-a&aff_id=pub-1&offer_id=camp-1&source=facebook",
    );
  });
});

describe("dispatchPublisherPostback", () => {
  const paidLead = {
    id: "lead-1",
    publisherId: "pub-1",
    campaignId: "camp-1",
    source: "src",
    subId: "sub-1",
    country: "US",
    cpl: 1,
    isTest: false,
    status: "PAID",
    campaign: { cpl: 1 },
  };

  const activePostback = {
    id: "pb-1",
    publisherId: "pub-1",
    status: "ACTIVE",
    endpoint: "https://tracker.example/pb?click_id={click_id}&payout={payout}",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    assertSafeOutboundUrl.mockImplementation(async (url: string) => new URL(url));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => "ok",
      }),
    );
    leadFindUnique.mockResolvedValue(paidLead);
    deliveryFindUnique.mockResolvedValue(null);
    publisherPostbackFindFirst.mockResolvedValue(activePostback);
    deliveryCreate.mockResolvedValue({ id: "del-1" });
  });

  it("skips inactive postbacks", async () => {
    publisherPostbackFindFirst.mockResolvedValue({
      ...activePostback,
      status: "INACTIVE",
    });
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips when a delivery already exists for the lead", async () => {
    deliveryFindUnique.mockResolvedValue({
      url: "https://tracker.example/pb?click_id=lead-1",
      status: "SUCCESS",
      httpStatus: 200,
      error: null,
    });
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result?.skipped).toBe(true);
    expect(result?.reason).toBe("already-delivered");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips test leads", async () => {
    leadFindUnique.mockResolvedValue({ ...paidLead, isTest: true });
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("records SUCCESS on HTTP 200", async () => {
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result?.ok).toBe(true);
    expect(result?.httpStatus).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      "https://tracker.example/pb?click_id=lead-1&payout=0.7",
      expect.objectContaining({ method: "GET" }),
    );
    expect(deliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead-1",
          event: "PAID",
          status: "SUCCESS",
          httpStatus: 200,
        }),
      }),
    );
  });

  it("records FAILED on HTTP 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 500,
        text: async () => "boom",
      }),
    );
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result?.ok).toBe(false);
    expect(result?.httpStatus).toBe(500);
    expect(deliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          httpStatus: 500,
        }),
      }),
    );
  });

  it("records FAILED when the request times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("The operation was aborted")),
    );
    const { dispatchPublisherPostback } = await import(
      "@/services/publisher-postback-dispatch"
    );
    const result = await dispatchPublisherPostback("lead-1");
    expect(result?.ok).toBe(false);
    expect(result?.error).toMatch(/aborted/);
    expect(deliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
        }),
      }),
    );
  });
});

describe("upsertPublisherPostback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects Active with an empty endpoint", async () => {
    const { upsertPublisherPostback } = await import(
      "@/services/publisher-postback.service"
    );
    await expect(
      upsertPublisherPostback("pub-1", { status: "ACTIVE", endpoint: "" }),
    ).rejects.toMatchObject({ message: expect.stringContaining("Endpoint is required") });
    expect(publisherPostbackCreate).not.toHaveBeenCalled();
    expect(publisherPostbackUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing CPL postback instead of creating another", async () => {
    publisherPostbackFindFirst.mockResolvedValue({ id: "pb-cpl" });
    publisherPostbackUpdate.mockResolvedValue({
      id: "pb-cpl",
      channel: "CPL",
      name: null,
      status: "ACTIVE",
      endpoint: "https://t.example/pb",
      updatedAt: new Date(),
    });
    const { upsertPublisherPostback } = await import("@/services/publisher-postback.service");
    await upsertPublisherPostback("pub-1", { status: "ACTIVE", endpoint: "https://t.example/pb" });
    expect(publisherPostbackFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publisherId: "pub-1", channel: "CPL" } }),
    );
    expect(publisherPostbackUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pb-cpl" } }),
    );
    expect(publisherPostbackCreate).not.toHaveBeenCalled();
  });
});

describe("multiple channel postbacks", () => {
  const row = {
    id: "pb-2",
    publisherId: "pub-1",
    channel: "CPA",
    name: "Voluum",
    status: "ACTIVE",
    endpoint: "https://t.example/pb?cid={click_id}",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a named postback for the channel", async () => {
    publisherPostbackCreate.mockResolvedValue(row);
    const { createPublisherPostback } = await import("@/services/publisher-postback.service");
    const result = await createPublisherPostback("pub-1", "CPA", {
      name: "  Voluum ",
      status: "ACTIVE",
      endpoint: " https://t.example/pb?cid={click_id} ",
    });
    expect(publisherPostbackCreate).toHaveBeenCalledWith({
      data: {
        publisherId: "pub-1",
        channel: "CPA",
        type: "S2S",
        name: "Voluum",
        status: "ACTIVE",
        endpoint: "https://t.example/pb?cid={click_id}",
      },
    });
    expect(result).toMatchObject({ id: "pb-2", name: "Voluum", channel: "CPA" });
  });

  it("rejects an Active postback without a URL", async () => {
    const { createPublisherPostback } = await import("@/services/publisher-postback.service");
    await expect(
      createPublisherPostback("pub-1", "DIGITAL_PRODUCT", { status: "ACTIVE", endpoint: " " }),
    ).rejects.toMatchObject({ message: expect.stringContaining("Endpoint is required") });
    expect(publisherPostbackCreate).not.toHaveBeenCalled();
  });

  it("only updates a postback owned by the publisher", async () => {
    publisherPostbackFindFirst.mockResolvedValue(null);
    const { updatePublisherPostback } = await import("@/services/publisher-postback.service");
    await expect(
      updatePublisherPostback("pub-other", "pb-2", { status: "INACTIVE", endpoint: "" }, "CPA"),
    ).rejects.toMatchObject({ message: expect.stringMatching(/not found/i) });
    expect(publisherPostbackFindFirst).toHaveBeenCalledWith({
      where: { id: "pb-2", publisherId: "pub-other", channel: "CPA" },
    });
    expect(publisherPostbackUpdate).not.toHaveBeenCalled();
  });

  it("keeps the name when an update leaves it out", async () => {
    publisherPostbackFindFirst.mockResolvedValue(row);
    publisherPostbackUpdate.mockResolvedValue({ ...row, status: "INACTIVE" });
    const { updatePublisherPostback } = await import("@/services/publisher-postback.service");
    await updatePublisherPostback("pub-1", "pb-2", { status: "INACTIVE", endpoint: row.endpoint });
    expect(publisherPostbackUpdate).toHaveBeenCalledWith({
      where: { id: "pb-2" },
      data: { type: "S2S", status: "INACTIVE", endpoint: row.endpoint, name: "Voluum" },
    });
  });

  it("deletes only the publisher's own postback", async () => {
    publisherPostbackFindFirst.mockResolvedValue(row);
    publisherPostbackDelete.mockResolvedValue(row);
    const { deletePublisherPostback } = await import("@/services/publisher-postback.service");
    await deletePublisherPostback("pub-1", "pb-2", "CPA");
    expect(publisherPostbackFindFirst).toHaveBeenCalledWith({
      where: { id: "pb-2", publisherId: "pub-1", channel: "CPA" },
    });
    expect(publisherPostbackDelete).toHaveBeenCalledWith({ where: { id: "pb-2" } });
  });
});
