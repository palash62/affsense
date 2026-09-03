import { fetchOgadsOffers, type OgadsOfferDto } from "@/lib/ogads-offer-api";
import { applyOfferWallAffiliatePayout } from "@/lib/ogads-offer-wall-settings";
import { resolveOgadsVisitorIp } from "@/lib/ogads-visitor-ip";
import { loadOgadsOfferWallConfig } from "@/services/ogads-offer-wall-settings.service";

export type OfferWallListPayload = {
  items: OgadsOfferDto[];
  configured: boolean;
  message: string | null;
};

export async function getOfferWallListForRequest(
  request: Request,
  options?: {
    affSub4?: string;
    unconfiguredMessage?: string;
    applyAffiliateShare?: boolean;
  },
): Promise<OfferWallListPayload> {
  const config = await loadOgadsOfferWallConfig();
  const configured = Boolean(config.apiKey.trim());

  if (!config.enabled) {
    return {
      items: [],
      configured,
      message: "Offer Wall is disabled by admin.",
    };
  }

  if (!configured) {
    return {
      items: [],
      configured: false,
      message:
        options?.unconfiguredMessage ??
        "Offer Wall is not configured yet. Ask admin to add the OGAds API key.",
    };
  }

  const ip = await resolveOgadsVisitorIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() || "Mozilla/5.0";
  const result = await fetchOgadsOffers({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    ip,
    userAgent,
    affSub4: options?.affSub4,
    max: config.max,
  });

  const items = options?.applyAffiliateShare
    ? result.offers.map((offer) => ({
        ...offer,
        payout: applyOfferWallAffiliatePayout(
          Number(offer.payout) || 0,
          config.affiliatePercent,
        ).toFixed(2),
      }))
    : result.offers;

  return {
    items,
    configured: true,
    message: result.error ?? null,
  };
}
