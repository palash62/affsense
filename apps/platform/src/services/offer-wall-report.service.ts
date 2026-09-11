import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { loadOgadsOfferWallConfig } from "@/services/ogads-offer-wall-settings.service";

export type OfferWallReportFilters = {
  q?: string;
  offerId?: string;
  subId?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type SerializedOfferWallReportRow = {
  offerId: string;
  offerName: string | null;
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: number;
  payout: number;
  networkPayout: number;
};

export type OfferWallReportResult = {
  items: SerializedOfferWallReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    clicks: number;
    conversions: number;
    conversionRate: number;
    epc: number;
    payout: number;
    networkPayout: number;
  };
};

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
}

function dateFilter(from?: string, to?: string): { gte?: Date; lte?: Date } | undefined {
  const gte = parseDateBound(from, false);
  const lte = parseDateBound(to, true);
  if (!gte && !lte) return undefined;
  return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
}

async function buildOfferWallReport(
  filters: OfferWallReportFilters,
  scopePublisherId?: string,
): Promise<OfferWallReportResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const createdAt = dateFilter(filters.from, filters.to);
  const publisherId = scopePublisherId ?? (filters.publisherId?.trim() || undefined);
  const offerId = filters.offerId?.trim() || undefined;
  const subId = filters.subId?.trim() || undefined;
  const q = filters.q?.trim().toLowerCase() || undefined;

  const clickWhere = {
    ...(publisherId ? { publisherId } : {}),
    ...(offerId ? { offerId } : {}),
    ...(subId ? { subId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { offerId: { contains: q } },
            { offerName: { contains: q } },
            { subId: { contains: q } },
          ],
        }
      : {}),
  };

  const conversionWhere = {
    ...(publisherId ? { publisherId } : {}),
    ...(offerId ? { offerId } : {}),
    ...(subId ? { subId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [{ offerId: { contains: q } }, { subId: { contains: q } }],
        }
      : {}),
  };

  const [clickGroups, conversionGroups, clickTotal, conversionAgg] = await Promise.all([
    prisma.offerwallClick.groupBy({
      by: ["offerId"],
      where: clickWhere,
      _count: { _all: true },
      _max: { offerName: true },
    }),
    prisma.offerwallConversion.groupBy({
      by: ["offerId"],
      where: conversionWhere,
      _count: { _all: true },
      _sum: { payout: true, networkPayout: true },
    }),
    prisma.offerwallClick.count({ where: clickWhere }),
    prisma.offerwallConversion.aggregate({
      where: conversionWhere,
      _count: { _all: true },
      _sum: { payout: true, networkPayout: true },
    }),
  ]);

  const byOffer = new Map<string, SerializedOfferWallReportRow>();

  for (const row of clickGroups) {
    byOffer.set(row.offerId, {
      offerId: row.offerId,
      offerName: row._max.offerName ?? null,
      clicks: row._count._all,
      conversions: 0,
      conversionRate: 0,
      epc: 0,
      payout: 0,
      networkPayout: 0,
    });
  }

  for (const row of conversionGroups) {
    const existing = byOffer.get(row.offerId) ?? {
      offerId: row.offerId,
      offerName: null as string | null,
      clicks: 0,
      conversions: 0,
      conversionRate: 0,
      epc: 0,
      payout: 0,
      networkPayout: 0,
    };
    existing.conversions = row._count._all;
    existing.payout = Number(row._sum.payout ?? 0);
    existing.networkPayout = Number(row._sum.networkPayout ?? 0);
    byOffer.set(row.offerId, existing);
  }

  // Prefer latest known offer name from clicks when missing.
  for (const [id, row] of byOffer) {
    if (!row.offerName) {
      const named = clickGroups.find((c) => c.offerId === id)?._max.offerName;
      if (named) row.offerName = named;
    }
    row.conversionRate = row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0;
    row.epc = row.clicks > 0 ? row.payout / row.clicks : 0;
  }

  const allRows = Array.from(byOffer.values()).sort(
    (a, b) => b.payout - a.payout || b.conversions - a.conversions || b.clicks - a.clicks,
  );
  const total = allRows.length;
  const items = allRows.slice((page - 1) * limit, page * limit);

  const conversions = conversionAgg._count._all;
  const payout = Number(conversionAgg._sum.payout ?? 0);
  const networkPayout = Number(conversionAgg._sum.networkPayout ?? 0);
  const clicks = clickTotal;

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats: {
      clicks,
      conversions,
      conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      epc: clicks > 0 ? payout / clicks : 0,
      payout,
      networkPayout,
    },
  };
}

export function listOfferWallReportForPublisher(
  publisherId: string,
  filters: OfferWallReportFilters,
) {
  return buildOfferWallReport(filters, publisherId);
}

export function listOfferWallReportForAdmin(filters: OfferWallReportFilters) {
  return buildOfferWallReport(filters);
}

function appendTrackingParams(
  trackingUrl: string,
  params: Record<string, string | undefined>,
): string {
  let url: URL;
  try {
    url = new URL(trackingUrl);
  } catch {
    throw Errors.validation("Invalid tracking URL");
  }
  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) url.searchParams.set(key, value.trim());
  }
  return url.toString();
}

export async function recordOfferWallClick(input: {
  publisherId: string;
  offerId: string;
  offerName?: string | null;
  trackingUrl: string;
  subId?: string | null;
  src?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  const config = await loadOgadsOfferWallConfig();
  if (!config.enabled) {
    throw new AppError("OFFER_WALL_DISABLED", "Offer Wall is disabled", 403);
  }

  const offerId = input.offerId.trim();
  const trackingUrl = input.trackingUrl.trim();
  if (!offerId) throw Errors.validation("offerId is required");
  if (!trackingUrl) throw Errors.validation("trackingUrl is required");

  const publisher = await prisma.user.findFirst({
    where: { id: input.publisherId, role: "PUBLISHER" },
    select: { id: true },
  });
  if (!publisher) throw Errors.notFound("Publisher");

  const click = await prisma.offerwallClick.create({
    data: {
      publisherId: publisher.id,
      offerId,
      offerName: input.offerName?.trim() || null,
      subId: input.subId?.trim() || null,
      src: input.src?.trim() || null,
      ip: input.ip?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
    },
  });

  const finalUrl = appendTrackingParams(trackingUrl, {
    aff_sub4: publisher.id,
    aff_sub: click.id,
    aff_sub2: input.subId?.trim() || undefined,
  });

  return { clickId: click.id, trackingUrl: finalUrl };
}
