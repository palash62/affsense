import { describe, expect, it } from "vitest";
import {
  appendSoloClickId,
  campaignIneligibilityReason,
  checkSoloClickLink,
  checkSoloDestinationUrl,
  cpcCentsForTraffic,
  providerCostCentsForTraffic,
  deviceFromUserAgent,
  dollarsToCents,
  generateSecret,
  generateSoloClickId,
  isLikelyBot,
  isSoloAdsAvailableFor,
  isSoloClickId,
  isSoloProofAttribution,
  isWithinAttributionWindow,
  localParts,
  pacingWeight,
  parseSoloAdsConfig,
  secretMatchesHash,
  weightedOrder,
  type RoutingCampaign,
} from "../../../../packages/tracking-core/src/solo";
import { soloCsvCell } from "../../src/components/solo-ads/solo-shared";

const CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function campaign(overrides: Partial<RoutingCampaign> = {}): RoutingCampaign {
  return {
    id: "c1",
    status: "ACTIVE",
    trafficType: "REGULAR",
    countries: ["US"],
    devices: [],
    activeHours: [],
    timezone: "UTC",
    startAt: null,
    endAt: null,
    destinationMode: "DIRECT",
    trackingVerifiedAt: null,
    dailyBudgetCents: 1000,
    lifetimeBudgetCents: 5000,
    cpcCentsSnapshot: 50,
    spentCents: 0,
    reservedCents: 0,
    usedTodayCents: 0,
    walletAvailableCents: 1000,
    blockedProviderIds: [],
    offerActive: true,
    ...overrides,
  };
}

const ctx = {
  at: new Date("2026-10-08T12:00:00Z"),
  trafficType: "REGULAR" as const,
  providerId: "p1",
  country: "US",
  device: "desktop" as const,
};

describe("solo settings", () => {
  it("defaults to disabled beta with sane prices", () => {
    const config = parseSoloAdsConfig(null);
    expect(config.enabled).toBe(false);
    expect(config.betaOnly).toBe(true);
    expect(cpcCentsForTraffic(config, "WARM")).toBeGreaterThan(cpcCentsForTraffic(config, "REGULAR"));
  });

  it("defaults provider cost to 0 and reads it per traffic type", () => {
    expect(providerCostCentsForTraffic(parseSoloAdsConfig(null), "REGULAR")).toBe(0);
    const config = parseSoloAdsConfig({ regularProviderCostCents: 20.4, warmProviderCostCents: -3 });
    expect(providerCostCentsForTraffic(config, "REGULAR")).toBe(20);
    expect(providerCostCentsForTraffic(config, "WARM")).toBe(0);
    expect(parseSoloAdsConfig({ warmProviderCostCents: "35" }).warmProviderCostCents).toBe(35);
  });

  it("clamps values and normalises countries", () => {
    const config = parseSoloAdsConfig({
      enabled: true,
      regularCpcCents: -5,
      supportedCountries: ["us", "US", "xx1", "gb"],
      minDailyBudgetCents: 5000,
      maxDailyBudgetCents: 100,
      fallbackUrl: "http://insecure.example",
    });
    expect(config.regularCpcCents).toBe(1);
    expect(config.supportedCountries).toEqual(["US", "GB"]);
    expect(config.maxDailyBudgetCents).toBe(5000);
    expect(config.fallbackUrl).toBe("https://affsense.com");
  });

  it("limits access to the beta allowlist", () => {
    const config = parseSoloAdsConfig({ enabled: true, betaOnly: true, betaPublisherIds: ["a"] });
    expect(isSoloAdsAvailableFor(config, "a")).toBe(true);
    expect(isSoloAdsAvailableFor(config, "b")).toBe(false);
    expect(isSoloAdsAvailableFor({ ...config, betaOnly: false }, "b")).toBe(true);
    expect(isSoloAdsAvailableFor({ ...config, enabled: false }, "a")).toBe(false);
  });
});

describe("ids and secrets", () => {
  it("creates opaque high-entropy click ids", () => {
    const ids = new Set(Array.from({ length: 500 }, generateSoloClickId));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(isSoloClickId(id)).toBe(true);
    expect(isSoloClickId("sc_short")).toBe(false);
    expect(isSoloClickId("101")).toBe(false);
  });

  it("verifies secrets only against their own hash", () => {
    const a = generateSecret("spt");
    const b = generateSecret("spt");
    expect(secretMatchesHash(a.secret, a.hash)).toBe(true);
    expect(secretMatchesHash(b.secret, a.hash)).toBe(false);
    expect(a.secret.startsWith(a.prefix)).toBe(true);
  });
});

describe("pacing", () => {
  it("resolves local dates across timezones", () => {
    const at = new Date("2026-10-08T23:30:00Z");
    expect(localParts(at, "UTC").date).toBe("2026-10-08");
    expect(localParts(at, "Asia/Kolkata").date).toBe("2026-10-09");
    expect(localParts(at, "America/New_York").date).toBe("2026-10-08");
    expect(localParts(at, "Not/AZone").date).toBe("2026-10-08");
  });

  it("gives behind-pace campaigns more weight and spent ones none", () => {
    const at = new Date("2026-10-08T12:00:00Z");
    const behind = pacingWeight({ dailyBudgetCents: 1000, usedTodayCents: 0, priority: 1, at, timeZone: "UTC" });
    const ahead = pacingWeight({ dailyBudgetCents: 1000, usedTodayCents: 900, priority: 1, at, timeZone: "UTC" });
    const done = pacingWeight({ dailyBudgetCents: 1000, usedTodayCents: 1000, priority: 1, at, timeZone: "UTC" });
    const boosted = pacingWeight({ dailyBudgetCents: 1000, usedTodayCents: 0, priority: 3, at, timeZone: "UTC" });
    expect(behind).toBeGreaterThan(ahead);
    expect(done).toBe(0);
    expect(boosted).toBeCloseTo(behind * 3);
  });

  it("orders candidates by weight and drops zero weights", () => {
    let seed = 0.1;
    const random = () => (seed = (seed * 9301 + 0.49297) % 1);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const first = weightedOrder(
        [
          { item: "a", weight: 9 },
          { item: "b", weight: 1 },
          { item: "z", weight: 0 },
        ],
        random,
      );
      expect(first).not.toContain("z");
      counts[first[0] as "a" | "b"] += 1;
    }
    expect(counts.a).toBeGreaterThan(counts.b * 4);
  });
});

describe("campaign eligibility", () => {
  it("accepts a matching campaign", () => {
    expect(campaignIneligibilityReason(campaign(), ctx)).toBeNull();
  });

  it.each([
    [{ status: "PAUSED" }, "not_active"],
    [{ trafficType: "WARM" as const }, "traffic_type"],
    [{ offerActive: false }, "offer_inactive"],
    [{ destinationMode: "EXTERNAL" as const }, "tracking_not_verified"],
    [{ blockedProviderIds: ["p1"] }, "provider_blocked"],
    [{ countries: ["GB"] }, "geo"],
    [{ devices: ["mobile"] }, "device"],
    [{ activeHours: [3] }, "schedule"],
    [{ usedTodayCents: 980 }, "daily_budget"],
    [{ spentCents: 4960 }, "lifetime_budget"],
    [{ walletAvailableCents: 49 }, "insufficient_funds"],
    [{ endAt: new Date("2026-10-08T00:00:00Z") }, "ended"],
  ])("rejects %o as %s", (overrides, reason) => {
    expect(campaignIneligibilityReason(campaign(overrides), ctx)).toBe(reason);
  });

  it("rejects unknown visitor geo", () => {
    expect(campaignIneligibilityReason(campaign(), { ...ctx, country: null })).toBe("geo");
  });
});

describe("destination safety", () => {
  it("accepts public https pages and strips click id + hash", () => {
    const check = checkSoloDestinationUrl("https://Example.com/optin?x=1&affs_click_id=old#top");
    expect(check).toEqual({ ok: true, url: "https://example.com/optin?x=1", host: "example.com" });
    expect(appendSoloClickId("https://example.com/optin?x=1", "sc_abc")).toBe(
      "https://example.com/optin?x=1&affs_click_id=sc_abc",
    );
  });

  it.each([
    "http://example.com",
    "https://localhost/page",
    "https://127.0.0.1/page",
    "https://10.0.0.5/page",
    "https://user:pass@example.com",
    "https://example.com:8443/page",
    "https://printer.local/page",
    "https://example.com/go?url=https://evil.example",
    "not a url",
  ])("rejects %s", (raw) => {
    expect(checkSoloDestinationUrl(raw).ok).toBe(false);
  });
});

describe("traffic screening", () => {
  it("flags bots and empty user agents", () => {
    expect(isLikelyBot(CHROME)).toBe(false);
    expect(isLikelyBot("")).toBe(true);
    expect(isLikelyBot("curl/8.4.0")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isLikelyBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/126.0")).toBe(true);
  });

  it("detects device classes", () => {
    expect(deviceFromUserAgent(CHROME)).toBe("desktop");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile")).toBe("mobile");
    expect(deviceFromUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("tablet");
  });
});

describe("attribution guards", () => {
  const click = {
    campaignId: "c1",
    publisherId: "pub1",
    offerType: "CPA" as const,
    cpaOfferId: "off1",
    digitalProductId: null,
    billingStatus: "BILLED",
    createdAt: new Date("2026-10-01T00:00:00Z"),
  };
  const base = { publisherId: "pub1", offerType: "CPA" as const, offerId: "off1", at: new Date("2026-10-08T00:00:00Z"), windowDays: 30 };

  it("only exact clicks and stored subscriptions are proof", () => {
    expect(isSoloProofAttribution("exact_click")).toBe(true);
    expect(isSoloProofAttribution("subscription")).toBe(true);
    for (const m of ["sub_match", "recent_click", "affiliate_ref", "lifetime_email", null]) {
      expect(isSoloProofAttribution(m)).toBe(false);
    }
  });

  it("links a matching, unexpired click", () => {
    expect(checkSoloClickLink({ ...base, click })).toEqual({ ok: true });
  });

  it.each([
    [{ click: null }, "not_found"],
    [{ click: { ...click, campaignId: null } }, "no_campaign"],
    [{ click: { ...click, billingStatus: "INVALID" } }, "invalid_click"],
    [{ publisherId: "pub2" }, "wrong_affiliate"],
    [{ offerId: "off2" }, "wrong_offer"],
    [{ offerType: "DIGITAL" as const }, "wrong_offer"],
    [{ at: new Date("2026-12-01T00:00:00Z") }, "expired"],
  ])("rejects %o as %s", (overrides, reason) => {
    expect(checkSoloClickLink({ ...base, click, ...overrides })).toEqual({ ok: false, reason });
  });

  it("checks the attribution window", () => {
    const at = new Date("2026-10-31T00:00:00Z");
    expect(isWithinAttributionWindow(new Date("2026-10-01T00:00:00Z"), at, 30)).toBe(true);
    expect(isWithinAttributionWindow(new Date("2026-09-30T00:00:00Z"), at, 30)).toBe(false);
    expect(isWithinAttributionWindow(new Date("2026-11-01T00:00:00Z"), at, 30)).toBe(false);
  });

  it("converts money without floating point drift", () => {
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    expect(dollarsToCents(null)).toBe(0);
  });
});

describe("solo CSV export", () => {
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(soloCsvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(soloCsvCell("+1")).toBe("'+1");
    expect(soloCsvCell(-1.25)).toBe("-1.25");
    expect(soloCsvCell("a,b")).toBe('"a,b"');
    expect(soloCsvCell(null)).toBe("");
  });
});
