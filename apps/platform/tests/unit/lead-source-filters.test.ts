import { describe, expect, it } from "vitest";
import {
  LEAD_SOURCE_FILTER_OPTIONS,
  normalizeLeadSourceFilter,
} from "@/lib/lead-source-filters";

describe("lead-source-filters", () => {
  it("includes traffic and platform source options", () => {
    const values = LEAD_SOURCE_FILTER_OPTIONS.map((o) => o.value);
    expect(values).toContain("all");
    expect(values).toContain("facebook");
    expect(values).toContain("optin");
    expect(values).toContain("landing_page");
    expect(values).toContain("campaign_test");
  });

  it("normalizes unknown source to all", () => {
    expect(normalizeLeadSourceFilter(null)).toBe("all");
    expect(normalizeLeadSourceFilter("facebook")).toBe("facebook");
    expect(normalizeLeadSourceFilter("unknown-source")).toBe("all");
  });
});
