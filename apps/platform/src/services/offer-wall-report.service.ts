import type { Prisma } from "@prisma/client";
import { formatMemberId } from "@cpl/shared";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { loadOgadsOfferWallConfig } from "@/services/ogads-offer-wall-settings.service";

export type OfferWallReportGroupBy = "offer" | "affiliate";

export type OfferWallReportFilters = {
  q?: string;
  offerId?: string;
  subId?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  groupBy?: OfferWallReportGroupBy;
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

export type SerializedOfferWallAffiliateRow = {
  publisherId: string;
  publisherName: string | null;
  publisherEmail: string | null;
  memberId: string | null;
  /** Distinct offers the affiliate converted on. */
  offers: number;
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: number;
  payout: number;
  networkPayout: number;
};

export type OfferWallReportResult = {
  groupBy: OfferWallReportGroupBy;
  items: SerializedOfferWallReportRow[] | SerializedOfferWallAffiliateRow[];
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

  const clickWhere: Prisma.OfferwallClickWhereInput = {
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

  const conversionWhere: Prisma.OfferwallConversionWhereInput = {
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

  const [clickTotal, conversionAgg] = await Promise.all([
    prisma.offerwallClick.count({ where: clickWhere }),
    prisma.offerwallConversion.aggregate({
      where: conversionWhere,
      _count: { _all: true },
      _sum: { payout: true, networkPayout: true },
    }),
  ]);

  const conversions = conversionAgg._count._all;
  const payout = Number(conversionAgg._sum.payout ?? 0);
  const networkPayout = Number(conversionAgg._sum.networkPayout ?? 0);
  const clicks = clickTotal;
  const stats = {
    clicks,
    conversions,
    conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
    epc: clicks > 0 ? payout / clicks : 0,
    payout,
    networkPayout,
  };

  const groupBy: OfferWallReportGroupBy =
    filters.groupBy === "affiliate" && !scopePublisherId ? "affiliate" : "offer";
  const allRows =
    groupBy === "affiliate"
      ? await buildAffiliateRows(clickWhere, conversionWhere)
      : await buildOfferRows(clickWhere, conversionWhere);
  const total = allRows.length;

  return {
    groupBy,
    items: allRows.slice((page - 1) * limit, page * limit) as OfferWallReportResult["items"],
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

function finalizeRates<T extends { clicks: number; conversions: number; payout: number; conversionRate: number; epc: number }>(row: T) {
  row.conversionRate = row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0;
  row.epc = row.clicks > 0 ? row.payout / row.clicks : 0;
}

function sortByPerformance<T extends { payout: number; conversions: number; clicks: number }>(rows: T[]) {
  return rows.sort(
    (a, b) => b.payout - a.payout || b.conversions - a.conversions || b.clicks - a.clicks,
  );
}

async function buildAffiliateRows(
  clickWhere: Prisma.OfferwallClickWhereInput,
  conversionWhere: Prisma.OfferwallConversionWhereInput,
): Promise<SerializedOfferWallAffiliateRow[]> {
  const [clickGroups, conversionGroups, offerPairs] = await Promise.all([
    prisma.offerwallClick.groupBy({
      by: ["publisherId"],
      where: clickWhere,
      _count: { _all: true },
    }),
    prisma.offerwallConversion.groupBy({
      by: ["publisherId"],
      where: conversionWhere,
      _count: { _all: true },
      _sum: { payout: true, networkPayout: true },
    }),
    prisma.offerwallConversion.groupBy({
      by: ["publisherId", "offerId"],
      where: conversionWhere,
    }),
  ]);

  const byPublisher = new Map<string, SerializedOfferWallAffiliateRow>();
  const ensure = (publisherId: string) => {
    let row = byPublisher.get(publisherId);
    if (!row) {
      row = {
        publisherId,
        publisherName: null,
        publisherEmail: null,
        memberId: null,
        offers: 0,
        clicks: 0,
        conversions: 0,
        conversionRate: 0,
        epc: 0,
        payout: 0,
        networkPayout: 0,
      };
      byPublisher.set(publisherId, row);
    }
    return row;
  };

  for (const g of clickGroups) ensure(g.publisherId).clicks = g._count._all;
  for (const g of conversionGroups) {
    const row = ensure(g.publisherId);
    row.conversions = g._count._all;
    row.payout = Number(g._sum.payout ?? 0);
    row.networkPayout = Number(g._sum.networkPayout ?? 0);
  }
  for (const pair of offerPairs) ensure(pair.publisherId).offers += 1;

  const users = await prisma.user.findMany({
    where: { id: { in: [...byPublisher.keys()] } },
    select: { id: true, name: true, email: true, memberNo: true },
  });
  for (const user of users) {
    const row = byPublisher.get(user.id);
    if (!row) continue;
    row.publisherName = user.name;
    row.publisherEmail = user.email;
    row.memberId = formatMemberId(user.memberNo);
  }

  const rows = [...byPublisher.values()];
  rows.forEach(finalizeRates);
  return sortByPerformance(rows);
}

async function buildOfferRows(
  clickWhere: Prisma.OfferwallClickWhereInput,
  conversionWhere: Prisma.OfferwallConversionWhereInput,
): Promise<SerializedOfferWallReportRow[]> {
  const [clickGroups, conversionGroups] = await Promise.all([
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
    finalizeRates(row);
  }

  return sortByPerformance(Array.from(byOffer.values()));
}

export function listOfferWallReportForPublisher(
  publisherId: string,
  filters: OfferWallReportFilters,
) {
  return buildOfferWallReport({ ...filters, groupBy: "offer" }, publisherId);
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
