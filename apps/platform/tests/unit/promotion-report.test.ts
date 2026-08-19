import { describe, it, expect } from "vitest";
import {
  PROMO_VISIT_DEDUPE_SECONDS,
  buildVisitDedupeKey,
  calculateSignupRate,
} from "@/lib/promotion-attribution";

describe("promotion report math", () => {
  it("returns null signup rate when there are no visits", () => {
    expect(calculateSignupRate(5, 0)).toBeNull();
  });

  it("rounds signup rate to one decimal place", () => {
    expect(calculateSignupRate(7, 20)).toBe(35);
    expect(calculateSignupRate(1, 6)).toBe(16.7);
  });

  it("uses a 30 minute visit dedupe window", () => {
    expect(PROMO_VISIT_DEDUPE_SECONDS).toBe(60 * 30);
  });

  it("builds dedupe keys by promotion id or utm tuple", () => {
    expect(buildVisitDedupeKey({ utmSource: "fb", utmCampaign: "x" }, "promo_1")).toBe(
      "promo:promo_1",
    );
    expect(buildVisitDedupeKey({ utmSource: "fb", utmCampaign: "x" })).toBe("utm:fb||x||");
  });
});
