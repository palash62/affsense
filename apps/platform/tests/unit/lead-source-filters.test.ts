import { describe, expect, it } from "vitest";
import { normalizeLeadSourceFilter } from "@/lib/lead-source-filters";

describe("lead-source-filters", () => {
  it("returns trimmed source or empty string", () => {
    expect(normalizeLeadSourceFilter(null)).toBe("");
    expect(normalizeLeadSourceFilter("  vita  ")).toBe("vita");
    expect(normalizeLeadSourceFilter("facebook")).toBe("facebook");
  });
});
