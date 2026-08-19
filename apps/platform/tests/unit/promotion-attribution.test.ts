import { describe, it, expect } from "vitest";
import {
  buildPromotionClickUrl,
  buildPromotionUrl,
  calculateSignupRate,
  encodeUtmQueryValue,
  mergePromotionAttribution,
  normalizeUtmTemplate,
  sanitizeUtmValue,
  utmKeyFromFields,
} from "@/lib/promotion-attribution";
import { buildPromotionVisitorKey } from "@/lib/promotion-attribution.server";

describe("promotion attribution helpers", () => {
  it("sanitizes unsafe characters but preserves templates separately", () => {
    expect(sanitizeUtmValue(" facebook ads! ")).toBe("facebook_ads_");
    expect(normalizeUtmTemplate("{{campaign.name}}")).toBe("{{campaign.name}}");
    expect(sanitizeUtmValue("{{campaign.name}}")).toBe("__campaign.name__");
  });

  it("builds landing URLs with unencoded brace macros", () => {
    const url = buildPromotionUrl("https://leadvix.io", {
      landingPath: "/",
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "{{campaign.name}}",
      utmContent: "{{ad.name}}",
    });

    expect(url).toContain("utm_campaign={{campaign.name}}");
    expect(url).toContain("utm_content={{ad.name}}");
    expect(encodeUtmQueryValue("{{campaign.name}}")).toBe("{{campaign.name}}");
  });

  it("merges URL attribution over cookie values", () => {
    const merged = mergePromotionAttribution(
      { utmSource: "google", utmCampaign: "spring", utmMedium: "cpc" },
      { utmSource: "facebook", utmCampaign: "winter", utmMedium: "paid", utmContent: "hero" },
    );

    expect(merged).toEqual({
      utmSource: "google",
      utmCampaign: "spring",
      utmMedium: "cpc",
      utmContent: "hero",
    });
  });

  it("formats tracked click URLs", () => {
    expect(buildPromotionClickUrl("https://leadvix.io", "promo_123")).toBe(
      "https://leadvix.io/api/v1/promo/click/promo_123",
    );
  });

  it("builds stable visitor keys", () => {
    const a = buildPromotionVisitorKey("1.2.3.4", "Mozilla/5.0");
    const b = buildPromotionVisitorKey("1.2.3.4", "Mozilla/5.0");
    const c = buildPromotionVisitorKey("1.2.3.5", "Mozilla/5.0");

    expect(a).toHaveLength(32);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("groups UTM tuples consistently", () => {
    expect(
      utmKeyFromFields({
        utmSource: "facebook",
        utmMedium: "paid",
        utmCampaign: "launch",
        utmContent: null,
        utmTerm: null,
      }),
    ).toBe("facebook|paid|launch||");
  });

  it("calculates signup rate to one decimal", () => {
    expect(calculateSignupRate(0, 10)).toBe(0);
    expect(calculateSignupRate(2, 8)).toBe(25);
    expect(calculateSignupRate(1, 3)).toBe(33.3);
    expect(calculateSignupRate(1, 0)).toBeNull();
  });
});
