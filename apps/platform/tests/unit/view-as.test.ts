import { describe, expect, it } from "vitest";
import { shouldApplyViewAs } from "@/lib/view-as";

describe("shouldApplyViewAs", () => {
  it("does not apply view-as on admin advertiser list API referer", () => {
    expect(
      shouldApplyViewAs(
        "/api/v1/admin/users",
        "https://affsense.com/admin/advertisers",
        "ADVERTISER",
      ),
    ).toBe(false);
  });

  it("does not apply view-as on admin publisher list API referer", () => {
    expect(
      shouldApplyViewAs(
        "/api/v1/admin/users",
        "https://affsense.com/admin/publishers",
        "PUBLISHER",
      ),
    ).toBe(false);
  });

  it("applies view-as on advertiser dashboard API referer", () => {
    expect(
      shouldApplyViewAs(
        "/api/v1/campaigns",
        "https://affsense.com/advertiser/campaigns",
        "ADVERTISER",
      ),
    ).toBe(true);
  });
});
