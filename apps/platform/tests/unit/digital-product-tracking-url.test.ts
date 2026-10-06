import { describe, expect, it } from "vitest";
import {
  buildCpaOfferTrackingUrl,
  buildDigitalProductDestinationUrl,
  buildDigitalProductTrackingUrl,
  readSubIds,
} from "@cpl/shared";

describe("readSubIds", () => {
  it("reads sub1-sub4 and treats sub_id as an alias for sub1", () => {
    expect(readSubIds(new URLSearchParams("sub1=a&sub2=b&sub3=c&sub4=d"))).toEqual({
      sub1: "a",
      sub2: "b",
      sub3: "c",
      sub4: "d",
    });
    expect(readSubIds(new URLSearchParams("sub_id=legacy"))).toEqual({
      sub1: "legacy",
      sub2: null,
      sub3: null,
      sub4: null,
    });
    expect(readSubIds(new URLSearchParams("sub1=new&sub_id=legacy")).sub1).toBe("new");
  });
});

describe("buildDigitalProductTrackingUrl", () => {
  it("builds tracking-domain share link with publisher and optional params", () => {
    const url = buildDigitalProductTrackingUrl(
      "prod1",
      {
        publisherId: "pub-9",
        src: "youtube",
        subId: "video1",
        campaign: "spring_promo",
      },
      "https://track.leadtb.com",
    );
    expect(url).toContain("https://track.leadtb.com/dp/prod1?");
    expect(url).toContain("pub_id=pub-9");
    expect(url).toContain("src=youtube");
    expect(url).toContain("sub_id=video1");
    expect(url).toContain("campaign=spring_promo");
  });

  it("writes Sub ID 2-4 as sub2/sub3/sub4", () => {
    const url = new URL(
      buildDigitalProductTrackingUrl(
        "prod1",
        { publisherId: "pub-9", subId: "a", subId2: "b", subId3: "c", subId4: "d" },
        "https://track.leadtb.com",
      ),
    );
    expect(url.searchParams.get("sub_id")).toBe("a");
    expect(url.searchParams.get("sub2")).toBe("b");
    expect(url.searchParams.get("sub3")).toBe("c");
    expect(url.searchParams.get("sub4")).toBe("d");
  });

  it("encodes product id in the path", () => {
    const url = buildDigitalProductTrackingUrl(
      "a/b",
      { publisherId: "pub-1" },
      "https://track.leadtb.com",
    );
    expect(url.startsWith("https://track.leadtb.com/dp/a%2Fb")).toBe(true);
  });

  it("adds page param only for an additional sales page", () => {
    const withPage = buildDigitalProductTrackingUrl(
      "prod1",
      { publisherId: "pub-1", pageId: "page-2" },
      "https://track.leadtb.com",
    );
    expect(withPage).toContain("page=page-2");

    const main = buildDigitalProductTrackingUrl(
      "prod1",
      { publisherId: "pub-1" },
      "https://track.leadtb.com",
    );
    expect(main).not.toContain("page=");
  });
});

describe("buildDigitalProductDestinationUrl", () => {
  it("appends affiliate param and extras to the sales page", () => {
    const url = buildDigitalProductDestinationUrl(
      "https://vendor.example/sales",
      "affsense_id",
      "pub-42",
      { source: "facebook", subid: "ad1", campaign: "launch" },
    );
    expect(url).toContain("https://vendor.example/sales?");
    expect(url).toContain("affsense_id=pub-42");
    expect(url).toContain("source=facebook");
    expect(url).toContain("subid=ad1");
    expect(url).toContain("campaign=launch");
  });

  it("appends the click id as aff_click", () => {
    const url = buildDigitalProductDestinationUrl(
      "https://vendor.example/sales",
      "affsense_id",
      "AFF100003",
      { clickId: "cmclick123" },
    );
    expect(url).toContain("affsense_id=AFF100003");
    expect(url).toContain("aff_click=cmclick123");
  });

  it("appends subid2, subid3 and subid4 when present", () => {
    const url = buildDigitalProductDestinationUrl(
      "https://vendor.example/sales",
      "affsense_id",
      "AFF100003",
      { subid: "fb", subid2: "adset1", subid3: "creative9", subid4: "geo_us" },
    );
    expect(url).toContain("subid=fb");
    expect(url).toContain("subid2=adset1");
    expect(url).toContain("subid3=creative9");
    expect(url).toContain("subid4=geo_us");
  });
});

describe("buildCpaOfferTrackingUrl", () => {
  it("writes Sub ID 1-4 and leaves empty ones out", () => {
    const url = new URL(
      buildCpaOfferTrackingUrl(
        "offer1",
        { publisherId: "AFF1", subId: "a", subId3: "c", subId4: "d" },
        "https://track.leadtb.com",
      ),
    );
    expect(url.pathname).toBe("/cpa/offer1");
    expect(url.searchParams.get("sub_id")).toBe("a");
    expect(url.searchParams.has("sub2")).toBe(false);
    expect(url.searchParams.get("sub3")).toBe("c");
    expect(url.searchParams.get("sub4")).toBe("d");
  });

  it("returns null when sales page or publisher is missing", () => {
    expect(
      buildDigitalProductDestinationUrl(null, "affsense_id", "pub-1"),
    ).toBeNull();
    expect(
      buildDigitalProductDestinationUrl("https://example.com", "affsense_id", ""),
    ).toBeNull();
  });
});
