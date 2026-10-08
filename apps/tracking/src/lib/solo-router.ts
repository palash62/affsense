import { prisma } from "@cpl/database";
import { countryFromRequestHeaders, lookupIpCountry, normalizeClientIp } from "@cpl/shared";
import {
  appendSoloClickId,
  bumpSoloStats,
  campaignIneligibilityReason,
  deviceFromUserAgent,
  generateSoloClickId,
  hashVisitorIp,
  isLikelyBot,
  isSoloAdsAvailableFor,
  loadSoloAdsConfig,
  localDate,
  pacingWeight,
  reserveSoloClick,
  sha256Hex,
  SoloReservationFailed,
  utcDate,
  weightedOrder,
  type RoutingCampaign,
  type SoloAdsConfig,
  type SoloDevice,
} from "@cpl/tracking-core";
import type { SoloTrafficType } from "@prisma/client";
import {
  buildCpaOfferDestination,
  buildDigitalProductDestination,
  clientIp,
  createCpaPublisherClick,
  createDigitalProductPublisherClick,
} from "@/lib/offer-clicks";

const MAX_RESERVATION_ATTEMPTS = 3;
const TOKEN_TOUCH_INTERVAL_MS = 60_000;

export type SoloRouteResult = { location: string; clickId: string | null; outcome: string };

type Visitor = {
  ip: string | null;
  ipHash: string;
  userAgent: string | null;
  uaHash: string | null;
  country: string | null;
  device: SoloDevice;
};

async function resolveCountry(request: Request, ip: string | null): Promise<string | null> {
  if (process.env.NODE_ENV !== "production") {
    const dev = process.env.SOLO_ADS_DEV_COUNTRY?.trim().toUpperCase();
    if (dev && /^[A-Z]{2}$/.test(dev)) return dev;
  }
  const header = countryFromRequestHeaders(request.headers);
  if (header) return header.toUpperCase();
  if (!ip) return null;
  const looked = await lookupIpCountry(ip).catch(() => undefined);
  return looked?.toUpperCase() ?? null;
}

async function recordUnroutedClick(input: {
  id: string;
  status: "INVALID" | "FALLBACK";
  reason: string;
  providerId: string;
  tokenId: string;
  trafficType: SoloTrafficType;
  visitor: Visitor;
  targetUrl: string;
  at: Date;
}) {
  await prisma.soloClick
    .create({
      data: {
        id: input.id,
        providerId: input.providerId,
        tokenId: input.tokenId,
        trafficType: input.trafficType,
        ipHash: input.visitor.ipHash,
        uaHash: input.visitor.uaHash,
        country: input.visitor.country,
        device: input.visitor.device,
        targetUrl: input.targetUrl,
        billingStatus: input.status,
        invalidReason: input.reason,
        localDate: utcDate(input.at),
        finalizedAt: input.at,
        createdAt: input.at,
      },
    })
    .catch((error) => console.error("[solo] failed to record unrouted click", error));
}

async function globalScreen(
  config: SoloAdsConfig,
  visitor: Visitor,
  provider: { geoRules: unknown },
  tokenId: string,
  at: Date,
): Promise<string | null> {
  if (config.blockBots && isLikelyBot(visitor.userAgent)) return "bot";
  if (!visitor.country || !config.supportedCountries.includes(visitor.country)) return "unsupported_geo";
  const geo = Array.isArray(provider.geoRules) ? (provider.geoRules as string[]) : [];
  if (geo.length > 0 && !geo.includes(visitor.country)) return "provider_geo";
  const [tokenRecent, ipRecent] = await Promise.all([
    prisma.soloClick.count({ where: { tokenId, createdAt: { gte: new Date(at.getTime() - 60_000) } } }),
    prisma.soloClick.count({ where: { ipHash: visitor.ipHash, createdAt: { gte: new Date(at.getTime() - 3_600_000) } } }),
  ]);
  if (tokenRecent >= config.maxClicksPerTokenPerMinute) return "token_rate";
  if (ipRecent >= config.maxClicksPerIpPerHour) return "ip_rate";
  return null;
}

async function loadCandidates(trafficType: SoloTrafficType, providerId: string, visitor: Visitor, config: SoloAdsConfig, at: Date) {
  const campaigns = await prisma.soloCampaign.findMany({
    where: { status: "ACTIVE", trafficType },
    include: {
      providerBlocks: { where: { providerId }, select: { providerId: true } },
      cpaOffer: { select: { id: true, status: true, visibility: true, trackingUrl: true } },
      digitalProduct: { select: { id: true, status: true, isPrivate: true, salesPageUrl: true, affiliateTrackingParam: true } },
      publisher: { select: { id: true, status: true, memberNo: true, soloWallet: { select: { balanceCents: true, reservedCents: true } } } },
    },
  });
  if (campaigns.length === 0) return [];

  const ids = campaigns.map((c) => c.id);
  const localDates = new Map(campaigns.map((c) => [c.id, localDate(at, c.timezone)]));
  const [usage, visited, cpaAccess, dpAccess] = await Promise.all([
    prisma.soloDailyUsage.findMany({
      where: { campaignId: { in: ids }, localDate: { in: [...new Set(localDates.values())] } },
      select: { campaignId: true, localDate: true, reservedCents: true, spentCents: true },
    }),
    prisma.soloClick.findMany({
      where: {
        ipHash: visitor.ipHash,
        campaignId: { in: ids },
        createdAt: { gte: new Date(at.getTime() - config.uniqueVisitorWindowHours * 3_600_000) },
      },
      select: { campaignId: true },
      distinct: ["campaignId"],
    }),
    prisma.publisherCpaOfferAccess.findMany({
      where: {
        status: "APPROVED",
        OR: campaigns
          .filter((c) => c.cpaOffer && c.cpaOffer.visibility !== "PUBLIC")
          .map((c) => ({ publisherId: c.publisherId, offerId: c.cpaOffer!.id })),
      },
      select: { publisherId: true, offerId: true },
    }),
    prisma.digitalProductAllowedPublisher.findMany({
      where: {
        OR: campaigns
          .filter((c) => c.digitalProduct?.isPrivate)
          .map((c) => ({ publisherId: c.publisherId, productId: c.digitalProduct!.id })),
      },
      select: { publisherId: true, productId: true },
    }),
  ]);
  const visitedIds = new Set(visited.map((v) => v.campaignId));

  return campaigns
    .map((c) => {
      const today = localDates.get(c.id)!;
      const used = usage.find((u) => u.campaignId === c.id && u.localDate === today);
      const wallet = c.publisher.soloWallet;
      let offerActive = false;
      if (c.offerType === "CPA" && c.cpaOffer) {
        offerActive =
          c.cpaOffer.status === "ACTIVE" &&
          (c.cpaOffer.visibility === "PUBLIC" ||
            cpaAccess.some((a) => a.publisherId === c.publisherId && a.offerId === c.cpaOffer!.id));
      } else if (c.offerType === "DIGITAL" && c.digitalProduct) {
        offerActive =
          c.digitalProduct.status === "ACTIVE" &&
          Boolean(c.digitalProduct.salesPageUrl?.trim()) &&
          (!c.digitalProduct.isPrivate ||
            dpAccess.some((a) => a.publisherId === c.publisherId && a.productId === c.digitalProduct!.id));
      }
      if (c.publisher.status !== "ACTIVE" || !isSoloAdsAvailableFor(config, c.publisherId)) offerActive = false;

      const routing: RoutingCampaign = {
        id: c.id,
        status: c.status,
        trafficType: c.trafficType,
        countries: (c.countries as string[]) ?? [],
        devices: (c.devices as string[] | null) ?? [],
        activeHours: (c.activeHours as number[] | null) ?? [],
        timezone: c.timezone,
        startAt: c.startAt,
        endAt: c.endAt,
        destinationMode: c.destinationMode,
        trackingVerifiedAt: c.trackingVerifiedAt,
        dailyBudgetCents: c.dailyBudgetCents,
        lifetimeBudgetCents: c.lifetimeBudgetCents,
        cpcCentsSnapshot: c.cpcCentsSnapshot,
        spentCents: c.spentCents,
        reservedCents: c.reservedCents,
        usedTodayCents: (used?.reservedCents ?? 0) + (used?.spentCents ?? 0),
        walletAvailableCents: wallet ? wallet.balanceCents - wallet.reservedCents : 0,
        blockedProviderIds: c.providerBlocks.map((b) => b.providerId),
        offerActive,
      };
      return { campaign: c, routing, localDate: today, visited: visitedIds.has(c.id) };
    })
    .filter((x) => !x.visited);
}

export async function routeSoloClick(request: Request, pool: string): Promise<SoloRouteResult> {
  const config = await loadSoloAdsConfig();
  const fallback = config.fallbackUrl;
  const trafficType: SoloTrafficType | null = pool === "regular" ? "REGULAR" : pool === "warm" ? "WARM" : null;
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!config.enabled || !trafficType || !token || token.length > 128) {
    return { location: fallback, clickId: null, outcome: "rejected" };
  }

  const tokenRow = await prisma.soloProviderToken.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { provider: true },
  });
  if (!tokenRow || tokenRow.status !== "ACTIVE" || tokenRow.trafficType !== trafficType || tokenRow.provider.status !== "ACTIVE") {
    return { location: fallback, clickId: null, outcome: "bad_token" };
  }

  const at = new Date();
  if (!tokenRow.lastUsedAt || at.getTime() - tokenRow.lastUsedAt.getTime() > TOKEN_TOUCH_INTERVAL_MS) {
    void prisma.soloProviderToken.update({ where: { id: tokenRow.id }, data: { lastUsedAt: at } }).catch(() => undefined);
  }

  const ip = normalizeClientIp(clientIp(request)) ?? null;
  const userAgent = request.headers.get("user-agent");
  const visitor: Visitor = {
    ip,
    ipHash: hashVisitorIp(ip ?? "unknown"),
    userAgent,
    uaHash: userAgent ? sha256Hex(userAgent) : null,
    country: await resolveCountry(request, ip),
    device: deviceFromUserAgent(userAgent),
  };
  const provider = tokenRow.provider;
  const id = generateSoloClickId();
  const base = { id, providerId: provider.id, tokenId: tokenRow.id, trafficType, visitor, at, targetUrl: fallback };

  const invalid = await globalScreen(config, visitor, provider, tokenRow.id, at);
  if (invalid) {
    await recordUnroutedClick({ ...base, status: "INVALID", reason: invalid });
    return { location: fallback, clickId: id, outcome: invalid };
  }

  const candidates = await loadCandidates(trafficType, provider.id, visitor, config, at);
  const ctx = { at, trafficType, providerId: provider.id, country: visitor.country, device: visitor.device };
  const eligible = candidates.filter((c) => campaignIneligibilityReason(c.routing, ctx) === null);
  const order = weightedOrder(
    eligible.map((c) => ({
      item: c,
      weight: pacingWeight({
        dailyBudgetCents: c.routing.dailyBudgetCents,
        usedTodayCents: c.routing.usedTodayCents,
        priority: c.campaign.priority,
        at,
        timeZone: c.campaign.timezone,
      }),
    })),
  );

  const origin = new URL(request.url).origin;
  for (const candidate of order.slice(0, MAX_RESERVATION_ATTEMPTS)) {
    const c = candidate.campaign;
    try {
      const location = await prisma.$transaction(async (tx) => {
        await reserveSoloClick(tx, {
          campaignId: c.id,
          publisherId: c.publisherId,
          providerId: provider.id,
          providerDailyCapacity: provider.dailyCapacity,
          cpcCents: c.cpcCentsSnapshot,
          dailyBudgetCents: c.dailyBudgetCents,
          localDate: candidate.localDate,
          at,
        });
        await tx.soloClick.create({
          data: {
            id,
            campaignId: c.id,
            providerId: provider.id,
            tokenId: tokenRow.id,
            publisherId: c.publisherId,
            trafficType,
            offerType: c.offerType,
            cpaOfferId: c.cpaOfferId,
            digitalProductId: c.digitalProductId,
            ipHash: visitor.ipHash,
            uaHash: visitor.uaHash,
            country: visitor.country,
            device: visitor.device,
            billingStatus: "PENDING",
            chargeCents: c.cpcCentsSnapshot,
            localDate: candidate.localDate,
            createdAt: at,
          },
        });

        let target: string | null;
        const subIds = { sub1: `solo_${c.id}`, sub2: `p${provider.publicCode}`, sub3: null, sub4: null };
        const clickVisitor = { ip, userAgent };
        if (c.destinationMode === "EXTERNAL" && c.destinationUrl) {
          target = appendSoloClickId(c.destinationUrl, id);
        } else if (c.offerType === "CPA" && c.cpaOffer) {
          const click = await createCpaPublisherClick(tx, {
            offerId: c.cpaOffer.id,
            publisherId: c.publisherId,
            subIds,
            src: "solo_ads",
            visitor: clickVisitor,
            soloClickId: id,
          });
          target = buildCpaOfferDestination({
            trackingUrl: c.cpaOffer.trackingUrl,
            clickId: click.id,
            origin,
            subIds,
            src: "solo_ads",
          });
        } else if (c.offerType === "DIGITAL" && c.digitalProduct?.salesPageUrl) {
          const click = await createDigitalProductPublisherClick(tx, {
            productId: c.digitalProduct.id,
            publisherId: c.publisherId,
            salesPageId: null,
            subIds,
            src: "solo_ads",
            campaign: null,
            visitor: clickVisitor,
            soloClickId: id,
          });
          target = buildDigitalProductDestination({
            salesPageUrl: c.digitalProduct.salesPageUrl,
            affiliateTrackingParam: c.digitalProduct.affiliateTrackingParam,
            memberNo: c.publisher.memberNo,
            subIds,
            src: "solo_ads",
            campaign: null,
            clickId: click.id,
          });
        } else {
          target = null;
        }
        if (!target) throw new SoloReservationFailed("no_destination");

        await tx.soloClick.update({ where: { id }, data: { targetUrl: target } });
        await bumpSoloStats(tx, { campaignId: c.id, providerId: provider.id, localDate: candidate.localDate }, { clicks: 1 });
        return target;
      });
      return { location, clickId: id, outcome: "routed" };
    } catch (error) {
      if (!(error instanceof SoloReservationFailed)) {
        console.error("[solo] routing attempt failed", { campaignId: c.id, error });
        continue;
      }
      if (error.reason === "provider_capacity") {
        await recordUnroutedClick({ ...base, status: "FALLBACK", reason: "provider_capacity" });
        return { location: fallback, clickId: id, outcome: "provider_capacity" };
      }
    }
  }

  await recordUnroutedClick({ ...base, status: "FALLBACK", reason: eligible.length ? "reservation_failed" : "no_campaign" });
  return { location: fallback, clickId: id, outcome: "fallback" };
}
