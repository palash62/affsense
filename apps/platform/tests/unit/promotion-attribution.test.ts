import { describe, expect, it } from "vitest";
import {
  buildPromotionClickUrl,
  buildPromotionUrl,
  buildPromotionVisitorKey,
  mergePromotionAttribution,
  normalizeAttributionForStorage,
  readPromotionAttributionFromUrl,
  sanitizeUtmValue,
  utmKeyFromFields,
} from "@/lib/promotion-attribution";

describe("promotion attribution", () => {
  it("parses UTM params from search string", () => {
    const attribution = readPromotionAttributionFromUrl(
      "?utm_source=facebook&utm_medium=paid_social&utm_campaign=fb_signup&utm_content=ad1&utm_term=lead",
    );
    expect(attribution.utmSource).toBe("facebook");
    expect(attribution.utmMedium).toBe("paid_social");
    expect(attribution.utmCampaign).toBe("fb_signup");
    expect(attribution.utmContent).toBe("ad1");
    expect(attribution.utmTerm).toBe("lead");
  });

  it("sanitizes unsafe UTM values", () => {
    expect(sanitizeUtmValue("  facebook  ")).toBe("facebook");
    expect(sanitizeUtmValue("paid/social!")).toBe("paid_social_");
  });

  it("merges URL attribution over cookie values", () => {
    const merged = mergePromotionAttribution(
      { utmSource: "facebook", utmCampaign: "new_campaign" },
      { utmSource: "google", utmMedium: "cpc", utmCampaign: "old" },
    );
    expect(merged.utmSource).toBe("facebook");
    expect(merged.utmMedium).toBe("cpc");
    expect(merged.utmCampaign).toBe("new_campaign");
  });

  it("builds home-page promotion URLs with UTM params", () => {
    const url = buildPromotionUrl("https://leadvix.io", {
      landingPath: "/",
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "fb_signup",
      utmContent: "ad_set_a",
    });
    expect(url).toBe(
      "https://leadvix.io/?utm_source=facebook&utm_medium=paid_social&utm_campaign=fb_signup&utm_content=ad_set_a",
    );
  });

  it("builds click-tracking URLs when promotion id is provided", () => {
    const url = buildPromotionUrl(
      "https://leadvix.io",
      {
        landingPath: "/",
        utmSource: "facebook",
        utmCampaign: "fb_signup",
      },
      { promotionId: "promo_123" },
    );
    expect(url).toBe("https://leadvix.io/api/v1/promo/click/promo_123");
    expect(buildPromotionClickUrl("https://leadvix.io", "promo_123")).toBe(
      "https://leadvix.io/api/v1/promo/click/promo_123",
    );
  });

  it("builds stable UTM keys and visitor keys", () => {
    expect(
      utmKeyFromFields({
        utmSource: "facebook",
        utmMedium: null,
        utmCampaign: "fb_signup",
      }),
    ).toBe("facebook||fb_signup||");

    const keyA = buildPromotionVisitorKey("1.1.1.1", "Mozilla/5.0");
    const keyB = buildPromotionVisitorKey("1.1.1.1", "Mozilla/5.0");
    const keyC = buildPromotionVisitorKey("2.2.2.2", "Mozilla/5.0");
    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(keyC);
    expect(keyA).toHaveLength(32);
  });

  it("normalizes attribution for storage and rejects empty payloads", () => {
    expect(normalizeAttributionForStorage({ utmSource: "facebook" })).toEqual({
      utmSource: "facebook",
    });
    expect(normalizeAttributionForStorage({})).toBeNull();
  });
});

describe("promotion report aggregation helpers", () => {
  function computeSignupRate(signupCount: number, visitCount: number): number | null {
    if (visitCount <= 0) return null;
    return Math.round((signupCount / visitCount) * 1000) / 10;
  }

  it("computes signup rate from visits", () => {
    expect(computeSignupRate(2, 10)).toBe(20);
    expect(computeSignupRate(0, 0)).toBeNull();
  });

  it("aggregates event counts by UTM key", () => {
    const events = [
      { eventType: "CLICK", utmSource: "facebook", utmCampaign: "fb_signup" },
      { eventType: "VISIT", utmSource: "facebook", utmCampaign: "fb_signup", visitorKey: "a" },
      { eventType: "VISIT", utmSource: "facebook", utmCampaign: "fb_signup", visitorKey: "a" },
      { eventType: "VISIT", utmSource: "facebook", utmCampaign: "fb_signup", visitorKey: "b" },
    ] as const;

    const byKey = new Map<string, { clicks: number; visits: number; unique: Set<string> }>();

    for (const event of events) {
      const key = utmKeyFromFields(event);
      const row = byKey.get(key) ?? { clicks: 0, visits: 0, unique: new Set<string>() };
      if (event.eventType === "CLICK") row.clicks += 1;
      if (event.eventType === "VISIT") {
        row.visits += 1;
        if ("visitorKey" in event && event.visitorKey) row.unique.add(event.visitorKey);
      }
      byKey.set(key, row);
    }

    const row = byKey.get("facebook||fb_signup||")!;
    expect(row.clicks).toBe(1);
    expect(row.visits).toBe(3);
    expect(row.unique.size).toBe(2);
    expect(computeSignupRate(1, row.visits)).toBe(33.3);
  });
});
