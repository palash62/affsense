import { describe, expect, it } from "vitest";
import {
  buildPromotionUrl,
  mergePromotionAttribution,
  normalizeAttributionForStorage,
  readPromotionAttributionFromUrl,
  sanitizeUtmValue,
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

  it("normalizes attribution for storage and rejects empty payloads", () => {
    expect(normalizeAttributionForStorage({ utmSource: "facebook" })).toEqual({
      utmSource: "facebook",
    });
    expect(normalizeAttributionForStorage({})).toBeNull();
  });
});
