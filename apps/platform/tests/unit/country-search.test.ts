import { describe, expect, it } from "vitest";
import {
  COUNTRY_SEARCH_OPTIONS,
  findCountryByName,
  searchCountries,
} from "@/lib/country-search";

const codes = (query: string) => searchCountries(COUNTRY_SEARCH_OPTIONS, query).map((o) => o.code);

describe("searchCountries", () => {
  it("returns every country for an empty query", () => {
    expect(searchCountries(COUNTRY_SEARCH_OPTIONS, "  ")).toHaveLength(249);
  });

  it("puts names starting with the query first", () => {
    expect(codes("ind").slice(0, 2)).toEqual(["IN", "ID"]);
    expect(codes("nep")[0]).toBe("NP");
  });

  it("finds a country by its ISO code", () => {
    expect(codes("np")[0]).toBe("NP");
    expect(codes("GB")[0]).toBe("GB");
  });

  it("ignores case and accents", () => {
    expect(codes("cote")).toContain("CI");
    expect(codes("REUNION")).toEqual(["RE"]);
    expect(codes("aland")).toContain("AX");
  });

  it("matches words inside a name", () => {
    expect(codes("kingdom")).toContain("GB");
  });

  it("returns nothing for unknown text", () => {
    expect(codes("zzzz")).toEqual([]);
  });
});

describe("findCountryByName", () => {
  it("resolves exact names and codes only", () => {
    expect(findCountryByName(COUNTRY_SEARCH_OPTIONS, "nepal")?.code).toBe("NP");
    expect(findCountryByName(COUNTRY_SEARCH_OPTIONS, "Curacao")?.code).toBe("CW");
    expect(findCountryByName(COUNTRY_SEARCH_OPTIONS, "np")?.code).toBe("NP");
    expect(findCountryByName(COUNTRY_SEARCH_OPTIONS, "nep")).toBeUndefined();
  });
});
