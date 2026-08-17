import { beforeEach, describe, expect, it, vi } from "vitest";
import { substitutePostbackMacros } from "@cpl/shared";
import { publisherPostbackSchema } from "@/lib/validations";
import { buildPublisherPostbackMacroContext } from "@/services/publisher-postback-dispatch";
import { assertHttpTemplateUrl } from "@/services/publisher-postback.service";

const publisherPostbackFindUnique = vi.fn();
const publisherPostbackUpsert = vi.fn();
const deliveryFindUnique = vi.fn();
const deliveryCreate = vi.fn();
const deliveryUpdate = vi.fn();
const leadFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    publisherPostback: {
      findUnique: (...args: unknown[]) => publisherPostbackFindUnique(...args),
      upsert: (...args: unknown[]) => publisherPostbackUpsert(...args),
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
  it("substitutes click_id, lead_id, payout, and sub1", () => {
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
      "https://tracker.example/pb?click_id={click_id}&lead_id={lead_id}&payout={payout}&sub1={sub1}&aff_id={aff_id}&offer_id={offer_id}&source={source}",
      context,
    );
    expect(url).toBe(
      "https://tracker.example/pb?click_id=lead-99&lead_id=lead-99&payout=0.7&sub1=sub-a&aff_id=pub-1&offer_id=camp-1&source=facebook",
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
    publisherPostbackFindUnique.mockResolvedValue(activePostback);
    deliveryCreate.mockResolvedValue({ id: "del-1" });
  });

  it("skips inactive postbacks", async () => {
    publisherPostbackFindUnique.mockResolvedValue({
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
    expect(publisherPostbackUpsert).not.toHaveBeenCalled();
  });
});
