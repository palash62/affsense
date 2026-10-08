import { describe, expect, it, vi } from "vitest";
import {
  buildDigitalProductDestinationUrl,
  formatMemberId,
  injectClickIdIntoTrackingUrl,
  type TrackingSubIds,
} from "@cpl/shared";

vi.mock("@cpl/database", () => ({ prisma: {} }));

const { buildCpaOfferDestination, buildDigitalProductDestination } = await import(
  "../../../tracking/src/lib/offer-clicks"
);

/** Inline redirect logic of `/cpa/[offerId]` before the Solo Ads refactor. */
function legacyCpaDestination(input: {
  trackingUrl: string;
  clickId: string | null;
  origin: string;
  advId: string | null;
  pubId: string | null;
  subIds: TrackingSubIds;
  src: string | null;
}) {
  let destination = input.trackingUrl;
  if (input.clickId) {
    destination = injectClickIdIntoTrackingUrl(destination, input.clickId, input.origin);
  }
  try {
    const target = destination.startsWith("/") ? new URL(destination, input.origin) : new URL(destination);
    if (input.advId) target.searchParams.set("adv_id", input.advId);
    if (input.pubId) target.searchParams.set("pub_id", input.pubId);
    if (input.subIds.sub1) {
      target.searchParams.set("sub_id", input.subIds.sub1);
      target.searchParams.set("sub1", input.subIds.sub1);
    }
    if (input.subIds.sub2) target.searchParams.set("sub2", input.subIds.sub2);
    if (input.subIds.sub3) target.searchParams.set("sub3", input.subIds.sub3);
    if (input.subIds.sub4) target.searchParams.set("sub4", input.subIds.sub4);
    if (input.src) target.searchParams.set("src", input.src);
    destination = target.toString();
  } catch {
    // keep original destination
  }
  return destination;
}

const ORIGIN = "https://track.example.com";
const NO_SUBS: TrackingSubIds = { sub1: null, sub2: null, sub3: null, sub4: null };
const ALL_SUBS: TrackingSubIds = { sub1: "a1", sub2: "b 2", sub3: "c&3", sub4: "d4" };

describe("CPA redirect destination parity", () => {
  const cases = [
    { name: "plain url", trackingUrl: "https://offer.example.com/lp", clickId: null },
    { name: "click_id macro", trackingUrl: "https://offer.example.com/lp?cid={click_id}", clickId: "clk123" },
    { name: "existing query", trackingUrl: "https://offer.example.com/lp?x=1&sub1=old", clickId: "clk9" },
    { name: "relative url", trackingUrl: "/go/offer?aff={click_id}", clickId: "clk7" },
    { name: "invalid url", trackingUrl: "not a url {click_id}", clickId: "clk5" },
  ];
  for (const c of cases) {
    for (const extras of [
      { advId: null, pubId: null, subIds: NO_SUBS, src: null },
      { advId: "ADV1", pubId: "PUB1", subIds: ALL_SUBS, src: "email" },
    ]) {
      it(`${c.name} (${extras.pubId ? "with" : "without"} params)`, () => {
        const input = { ...c, origin: ORIGIN, ...extras };
        expect(buildCpaOfferDestination(input)).toBe(legacyCpaDestination(input));
      });
    }
  }
});

describe("Digital product redirect destination parity", () => {
  const salesPageUrl = "https://vendor.example.com/sales?ref=x";
  for (const param of [null, "aff_id"]) {
    for (const withExtras of [false, true]) {
      it(`param=${param ?? "default"} extras=${withExtras}`, () => {
        const subIds = withExtras ? ALL_SUBS : NO_SUBS;
        const src = withExtras ? "fb" : null;
        const campaign = withExtras ? "spring" : null;
        const clickId = withExtras ? "dpclk1" : undefined;
        const legacy = buildDigitalProductDestinationUrl(salesPageUrl, param, formatMemberId(42), {
          source: src ?? undefined,
          subid: subIds.sub1 ?? undefined,
          subid2: subIds.sub2 ?? undefined,
          subid3: subIds.sub3 ?? undefined,
          subid4: subIds.sub4 ?? undefined,
          campaign: campaign ?? undefined,
          clickId,
        });
        expect(
          buildDigitalProductDestination({
            salesPageUrl,
            affiliateTrackingParam: param,
            memberNo: 42,
            subIds,
            src,
            campaign,
            clickId,
          }),
        ).toBe(legacy);
      });
    }
  }
});
