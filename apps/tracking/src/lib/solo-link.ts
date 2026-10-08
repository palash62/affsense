import { prisma } from "@cpl/database";
import { checkSoloClickLink, isSoloClickId, loadSoloAdsConfig } from "@cpl/tracking-core";

export const SOLO_CLICK_PARAM = "affs_click_id";

/**
 * Validate a browser-supplied `affs_click_id` against the affiliate and offer
 * of this redirect. Returns the canonical id only when every field matches.
 */
export async function resolveSoloClickLink(input: {
  rawId: string | null;
  publisherId: string;
  offerType: "CPA" | "DIGITAL";
  offerId: string;
}): Promise<string | null> {
  const rawId = input.rawId?.trim();
  if (!rawId || !isSoloClickId(rawId)) return null;
  const [click, config] = await Promise.all([
    prisma.soloClick.findUnique({
      where: { id: rawId },
      select: {
        campaignId: true,
        publisherId: true,
        offerType: true,
        cpaOfferId: true,
        digitalProductId: true,
        billingStatus: true,
        createdAt: true,
      },
    }),
    loadSoloAdsConfig(),
  ]);
  const check = checkSoloClickLink({
    click,
    publisherId: input.publisherId,
    offerType: input.offerType,
    offerId: input.offerId,
    at: new Date(),
    windowDays: config.attributionWindowDays,
  });
  if (!check.ok) {
    console.warn("[solo] affs_click_id rejected", { id: rawId, reason: check.reason });
    return null;
  }
  return rawId;
}

/** Offer click already created for this Solo click (repeat click-through from the affiliate's page). */
export async function findLinkedCpaClick(soloClickId: string) {
  return prisma.cpaOfferClick.findUnique({ where: { soloClickId }, select: { id: true } });
}

export async function findLinkedDigitalProductClick(soloClickId: string) {
  return prisma.digitalProductClick.findUnique({ where: { soloClickId }, select: { id: true } });
}
