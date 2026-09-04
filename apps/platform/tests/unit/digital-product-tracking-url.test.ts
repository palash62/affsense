import { describe, expect, it } from "vitest";
import {
  buildDigitalProductDestinationUrl,
  buildDigitalProductTrackingUrl,
} from "@cpl/shared";

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

  it("encodes product id in the path", () => {
    const url = buildDigitalProductTrackingUrl(
      "a/b",
      { publisherId: "pub-1" },
      "https://track.leadtb.com",
    );
    expect(url.startsWith("https://track.leadtb.com/dp/a%2Fb")).toBe(true);
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

  it("returns null when sales page or publisher is missing", () => {
    expect(
      buildDigitalProductDestinationUrl(null, "affsense_id", "pub-1"),
    ).toBeNull();
    expect(
      buildDigitalProductDestinationUrl("https://example.com", "affsense_id", ""),
    ).toBeNull();
  });
});
