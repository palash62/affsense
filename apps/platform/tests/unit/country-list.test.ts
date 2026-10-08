import { describe, expect, it } from "vitest";
import { COUNTRY_BY_CODE, getCountryName } from "@/lib/campaign-form";

describe("COUNTRY_BY_CODE", () => {
  const codes = Object.keys(COUNTRY_BY_CODE);

  it("covers the full ISO 3166-1 alpha-2 list", () => {
    expect(codes).toHaveLength(249);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
    expect(new Set(Object.values(COUNTRY_BY_CODE)).size).toBe(codes.length);
  });

  it("includes countries that were missing before", () => {
    for (const code of ["ZW", "NP", "MA", "ET", "JM", "QA", "KW", "CN", "RU", "HR"]) {
      expect(COUNTRY_BY_CODE[code]).toBeTruthy();
    }
    expect(getCountryName("NP")).toBe("Nepal");
  });

  it("keeps the existing names", () => {
    expect(getCountryName("US")).toBe("United States");
    expect(getCountryName("GB")).toBe("United Kingdom");
    expect(getCountryName("IN")).toBe("India");
    expect(getCountryName("CZ")).toBe("Czech Republic");
    expect(getCountryName("TR")).toBe("Turkey");
  });
});
