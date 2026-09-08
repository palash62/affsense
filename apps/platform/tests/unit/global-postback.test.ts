import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_CPA_NETWORK_POSTBACK_CONFIG,
  normalizeCpaNetworkPostbackInput,
  parseCpaNetworkPostbackConfig,
} from "@/lib/tracking/cpa-network-postback-settings";
import {
  injectClickIdIntoTrackingUrl,
  substitutePostbackMacros,
} from "@cpl/shared";
import {
  adminCpaNetworkPostbackSchema,
  advertiserGlobalPostbackSchema,
} from "@/lib/validations";
import { resolveCpaClickAttribution } from "../../../../packages/tracking-core/src/cpa-click-attribution";
import {
  inboundClickIdErrorMessage,
  normalizeClickId,
  resolveInboundClickId,
} from "../../../../packages/tracking-core/src/cpa-inbound-click-id";
import { isPostbackSecurityAuthorized } from "../../../../packages/tracking-core/src/cpa-postback-dispatch";
import { assertSafeOutboundUrl } from "../../../../packages/tracking-core/src/safe-outbound-url";

describe("CPA network postback settings", () => {
  it("returns defaults for empty values", () => {
    expect(parseCpaNetworkPostbackConfig(null)).toEqual(DEFAULT_CPA_NETWORK_POSTBACK_CONFIG);
  });

  it("parses stored config", () => {
    expect(
      parseCpaNetworkPostbackConfig({
        useSecurityKey: true,
        securityKey: " secret123 ",
        parallelPostbackUrl: " https://hooks.example.com/pb ",
      }),
    ).toEqual({
      version: 1,
      useSecurityKey: true,
      securityKey: "secret123",
      parallelPostbackUrl: "https://hooks.example.com/pb",
    });
  });

  it("rejects short security keys when enabled", () => {
    expect(() =>
      normalizeCpaNetworkPostbackInput({
        useSecurityKey: true,
        securityKey: "abc",
        parallelPostbackUrl: "",
      }),
    ).toThrow(/at least 6/);
  });

  it("rejects invalid parallel URLs", () => {
    expect(() =>
      normalizeCpaNetworkPostbackInput({
        useSecurityKey: false,
        parallelPostbackUrl: "not-a-url",
      }),
    ).toThrow(/valid parallel postback URL/);
  });

  it("validates admin schema", () => {
    const ok = adminCpaNetworkPostbackSchema.safeParse({
      useSecurityKey: false,
      securityKey: "",
      parallelPostbackUrl: "https://example.com/x?offer_id={offer_id}",
    });
    expect(ok.success).toBe(true);
  });
});

describe("Advertiser global postback validation", () => {
  it("accepts S2S payload", () => {
    const parsed = advertiserGlobalPostbackSchema.safeParse({
      type: "S2S",
      status: "ACTIVE",
      endpoint: "https://track.example.com/pb?click_id={click_id}",
    });
    expect(parsed.success).toBe(true);
  });

  it("allows blank inactive endpoint", () => {
    const parsed = advertiserGlobalPostbackSchema.safeParse({
      type: "HTML",
      status: "INACTIVE",
      endpoint: "",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("postback security key", () => {
  it("accepts when disabled", () => {
    expect(
      isPostbackSecurityAuthorized({ useSecurityKey: false, securityKey: "" }, null),
    ).toBe(true);
  });

  it("rejects missing/wrong key when enabled", () => {
    expect(
      isPostbackSecurityAuthorized(
        { useSecurityKey: true, securityKey: "testkey123" },
        null,
      ),
    ).toBe(false);
    expect(
      isPostbackSecurityAuthorized(
        { useSecurityKey: true, securityKey: "testkey123" },
        "wrong",
      ),
    ).toBe(false);
  });

  it("accepts matching key when enabled", () => {
    expect(
      isPostbackSecurityAuthorized(
        { useSecurityKey: true, securityKey: "testkey123" },
        "testkey123",
      ),
    ).toBe(true);
  });
});

describe("click attribution", () => {
  it("attributes matching platform click for the offer", () => {
    const result = resolveCpaClickAttribution({
      offerId: "offer1",
      inboundClickId: "click1",
      click: {
        id: "click1",
        offerId: "offer1",
        advertiserId: "adv1",
        publisherId: "pub1",
        src: "fb",
        subId: "camp&x=1",
      },
    });
    expect(result.advertiserId).toBe("adv1");
    expect(result.publisherId).toBe("pub1");
    expect(result.attributedClickId).toBe("click1");
    expect(result.clickRecordId).toBe("click1");
    expect(result.subId).toBe("camp&x=1");
  });

  it("does not attribute free-form or wrong-offer click ids", () => {
    expect(
      resolveCpaClickAttribution({
        offerId: "offer1",
        inboundClickId: "network-txn-99",
        click: null,
      }).advertiserId,
    ).toBeNull();

    expect(
      resolveCpaClickAttribution({
        offerId: "offer1",
        inboundClickId: "click1",
        click: {
          id: "click1",
          offerId: "other-offer",
          advertiserId: "adv1",
          src: null,
          subId: null,
        },
      }).attributedClickId,
    ).toBeNull();
  });
});

describe("postback macros", () => {
  it("substitutes and URL-encodes macros", () => {
    const url = substitutePostbackMacros(
      "https://x.test/pb?c={click_id}&p={payout}&a={aff_id}&o={offer_id}&s={source}&d={date}&s1={sub1}",
      {
        clickId: "clk_1",
        payout: "12.50",
        affId: "adv_9",
        offerId: "off_3",
        source: "fb",
        date: "2026-07-19",
        sub1: "camp&evil=1",
      },
    );
    expect(url).toBe(
      "https://x.test/pb?c=clk_1&p=12.50&a=adv_9&o=off_3&s=fb&d=2026-07-19&s1=camp%26evil%3D1",
    );
  });

  it("injects click id into tracking URL", () => {
    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/offer?foo=1",
        "click123",
        "http://localhost:3001",
      ),
    ).toContain("click_id=click123");

    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/offer?id={click_id}",
        "click123",
        "http://localhost:3001",
      ),
    ).toBe("https://network.test/offer?id=click123");

    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/offer?id={aff_click_id}",
        "click123",
        "http://localhost:3001",
      ),
    ).toBe("https://network.test/offer?id=click123");

    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/click?sub1=[click_id]",
        "click123",
        "http://localhost:3001",
      ),
    ).toBe("https://network.test/click?sub1=click123");

    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/click?sub1=[click_id]&sub2=[aff_click_id]",
        "click123",
        "http://localhost:3001",
      ),
    ).toBe("https://network.test/click?sub1=click123&sub2=click123");

    expect(
      injectClickIdIntoTrackingUrl(
        "https://network.test/click?sub1=%7Bclick_id%7D&adv_id=adv123",
        "click123",
        "http://localhost:3001",
      ),
    ).toBe("https://network.test/click?sub1=click123&adv_id=adv123");
  });
});

describe("safe outbound URL", () => {
  it("allows localhost http in non-production", async () => {
    const url = await assertSafeOutboundUrl("http://localhost:9999/hook");
    expect(url.hostname).toBe("localhost");
  });

  it("blocks private IP hosts", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1/x", { allowHttpLocalhost: false })).rejects.toThrow();
    await expect(assertSafeOutboundUrl("https://192.168.1.10/x")).rejects.toThrow(/not allowed/);
  });
});

describe("inbound click id parsing", () => {
  it("accepts click_id and aff_click_id", () => {
    const fromClickId = resolveInboundClickId((key) =>
      key === "click_id" ? "clk_abc" : null,
    );
    const fromAff = resolveInboundClickId((key) =>
      key === "aff_click_id" ? "clk_aff" : null,
    );
    expect(fromClickId).toBe("clk_abc");
    expect(fromAff).toBe("clk_aff");
  });

  it("rejects missing and placeholder macros", () => {
    expect(normalizeClickId(null)).toBeNull();
    expect(normalizeClickId("{click_id}")).toBeNull();
    expect(normalizeClickId("{aff_click_id}")).toBeNull();
    expect(normalizeClickId("[click_id]")).toBeNull();
    expect(normalizeClickId("[aff_click_id]")).toBeNull();
    expect(inboundClickIdErrorMessage("placeholder")).toMatch(/\[click_id\]/);
    expect(inboundClickIdErrorMessage("unknown")).toMatch(/Unknown click_id/);
  });
});

describe("CPA postback dispatch", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("fires admin parallel and advertiser S2S URLs", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@cpl/database", () => ({
      prisma: {
        platformSetting: {
          findUnique: vi.fn(async () => ({
            value: {
              useSecurityKey: false,
              securityKey: "",
              parallelPostbackUrl:
                "http://localhost:9999/hook?offer_id={offer_id}&aff={aff_id}&payout={payout}",
            },
          })),
        },
        advertiserGlobalPostback: {
          findUnique: vi.fn(async () => ({
            type: "S2S",
            status: "ACTIVE",
            endpoint: "http://localhost:9998/pb?click_id={click_id}&payout={payout}",
          })),
        },
        cpaPostbackDelivery: {
          upsert: vi.fn(async () => ({})),
        },
      },
    }));

    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );

    await dispatchCpaConversionPostbacks({
      conversionId: "conv1",
      offerId: "offer1",
      advertiserId: "adv1",
      clickId: "click1",
      payout: "10",
      source: "src",
      subId: "sub",
    });

    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("localhost:9999") && u.includes("offer1"))).toBe(true);
    expect(urls.some((u) => u.includes("localhost:9998") && u.includes("click1"))).toBe(true);
  });

  it("includes click_id in admin parallel URL when macro is present", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@cpl/database", () => ({
      prisma: {
        platformSetting: {
          findUnique: vi.fn(async () => ({
            value: {
              useSecurityKey: false,
              securityKey: "",
              parallelPostbackUrl:
                "http://localhost:9999/hook?offer_id={offer_id}&click_id={click_id}&payout={payout}",
            },
          })),
        },
        advertiserGlobalPostback: {
          findUnique: vi.fn(async () => null),
        },
        cpaPostbackDelivery: {
          upsert: vi.fn(async () => ({})),
        },
      },
    }));

    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );

    await dispatchCpaConversionPostbacks({
      conversionId: "conv_parallel",
      offerId: "offer1",
      advertiserId: "adv1",
      clickId: "click99",
      payout: "5",
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("click_id=click99") || u.includes("click99"))).toBe(true);
  });

  it("skips inactive advertiser postback", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.doMock("@cpl/database", () => ({
      prisma: {
        platformSetting: {
          findUnique: vi.fn(async () => null),
        },
        advertiserGlobalPostback: {
          findUnique: vi.fn(async () => ({
            type: "S2S",
            status: "INACTIVE",
            endpoint: "https://adv.example.com/pb",
          })),
        },
        cpaPostbackDelivery: {
          upsert: vi.fn(async () => ({})),
        },
      },
    }));

    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );

    await dispatchCpaConversionPostbacks({
      conversionId: "conv2",
      offerId: "offer1",
      advertiserId: "adv1",
      clickId: "click1",
      payout: "10",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still fires advertiser when admin delivery record fails", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const upsert = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValue({});

    vi.doMock("@cpl/database", () => ({
      prisma: {
        platformSetting: {
          findUnique: vi.fn(async () => ({
            value: {
              useSecurityKey: false,
              securityKey: "",
              parallelPostbackUrl: "http://localhost:9999/admin",
            },
          })),
        },
        advertiserGlobalPostback: {
          findUnique: vi.fn(async () => ({
            type: "S2S",
            status: "ACTIVE",
            endpoint: "http://localhost:9998/adv?click_id={click_id}",
          })),
        },
        cpaPostbackDelivery: { upsert },
      },
    }));

    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );

    await dispatchCpaConversionPostbacks({
      conversionId: "conv3",
      offerId: "offer1",
      advertiserId: "adv1",
      clickId: "click1",
      payout: "5",
    });

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes("localhost:9999"))).toBe(true);
    expect(urls.some((u) => u.includes("localhost:9998") && u.includes("click1"))).toBe(true);
  });

  it("blocks unsafe outbound host via failed fire (no success)", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const upsert = vi.fn(async () => ({}));

    vi.doMock("@cpl/database", () => ({
      prisma: {
        platformSetting: {
          findUnique: vi.fn(async () => ({
            value: {
              useSecurityKey: false,
              securityKey: "",
              parallelPostbackUrl: "https://192.168.0.50/evil",
            },
          })),
        },
        advertiserGlobalPostback: {
          findUnique: vi.fn(async () => null),
        },
        cpaPostbackDelivery: { upsert },
      },
    }));

    const { dispatchCpaConversionPostbacks } = await import(
      "../../../../packages/tracking-core/src/cpa-postback-dispatch"
    );

    await dispatchCpaConversionPostbacks({
      conversionId: "conv4",
      offerId: "offer1",
      advertiserId: null,
      clickId: null,
      payout: "1",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });
});
