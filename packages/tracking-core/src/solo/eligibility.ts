import { localParts } from "./pacing";

export type SoloDevice = "desktop" | "mobile" | "tablet";

export type RoutingCampaign = {
  id: string;
  status: string;
  trafficType: "REGULAR" | "WARM";
  countries: string[];
  devices: string[];
  activeHours: number[];
  timezone: string;
  startAt: Date | null;
  endAt: Date | null;
  destinationMode: "DIRECT" | "EXTERNAL";
  trackingVerifiedAt: Date | null;
  dailyBudgetCents: number;
  lifetimeBudgetCents: number;
  cpcCentsSnapshot: number;
  spentCents: number;
  reservedCents: number;
  usedTodayCents: number;
  walletAvailableCents: number;
  blockedProviderIds: string[];
  offerActive: boolean;
};

export type RoutingContext = {
  at: Date;
  trafficType: "REGULAR" | "WARM";
  providerId: string;
  country: string | null;
  device: SoloDevice;
};

/**
 * Why a campaign cannot take this click, or null when it can. Budget and
 * balance checks here only pre-filter; the reservation enforces them atomically.
 */
export function campaignIneligibilityReason(c: RoutingCampaign, ctx: RoutingContext): string | null {
  if (c.status !== "ACTIVE") return "not_active";
  if (c.trafficType !== ctx.trafficType) return "traffic_type";
  if (!c.offerActive) return "offer_inactive";
  if (c.destinationMode === "EXTERNAL" && !c.trackingVerifiedAt) return "tracking_not_verified";
  if (c.startAt && ctx.at < c.startAt) return "not_started";
  if (c.endAt && ctx.at >= c.endAt) return "ended";
  if (c.blockedProviderIds.includes(ctx.providerId)) return "provider_blocked";
  if (!ctx.country || !c.countries.includes(ctx.country)) return "geo";
  if (c.devices.length > 0 && !c.devices.includes(ctx.device)) return "device";
  if (c.activeHours.length > 0) {
    const { hour } = localParts(ctx.at, c.timezone);
    if (!c.activeHours.includes(hour)) return "schedule";
  }
  if (c.usedTodayCents + c.cpcCentsSnapshot > c.dailyBudgetCents) return "daily_budget";
  if (c.spentCents + c.reservedCents + c.cpcCentsSnapshot > c.lifetimeBudgetCents) return "lifetime_budget";
  if (c.walletAvailableCents < c.cpcCentsSnapshot) return "insufficient_funds";
  return null;
}
