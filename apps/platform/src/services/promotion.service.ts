import type { Prisma, Promotion, PromotionEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import {
  buildPromotionUrl,
  calculateSignupRate,
  normalizeAttributionForStorage,
  type PromotionAttributionPayload,
  type PromotionUtmFields,
  PROMO_VISIT_DEDUPE_SECONDS,
  sanitizeUtmValue,
  utmKeyFromFields,
} from "@/lib/promotion-attribution";
import { buildPromotionVisitorKey } from "@/lib/promotion-attribution.server";

export type PromotionInput = {
  name: string;
  utmSource: string;
  utmMedium?: string | null;
  utmCampaign: string;
  utmContent?: string | null;
  utmTerm?: string | null;
  landingPath?: string;
  isActive?: boolean;
};

export type SerializedPromotion = {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
  landingPath: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clickCount: number;
  visitCount: number;
  uniqueVisits: number;
  signupCount: number;
};

export type PromotionReportAdvertiser = {
  id: string;
  name: string;
  email: string;
  status: string;
  signupAt: string;
  createdAt: Date;
  depositTotal: number;
};

export type PromotionReportRow = PromotionUtmFields & {
  key: string;
  clickCount: number;
  visitCount: number;
  uniqueVisits: number;
  signupCount: number;
  signupRate: number | null;
  totalDeposits: number;
  avgDeposit: number | null;
  advertisers: PromotionReportAdvertiser[];
};

export type PromotionReportStats = {
  totalClicks: number;
  totalVisits: number;
  uniqueVisitors: number;
  attributedSignups: number;
  unattributedSignups: number;
  attributedDeposits: number;
  activePromotions: number;
};

export type PromotionReport = {
  stats: PromotionReportStats;
  rows: PromotionReportRow[];
};

type RequestMeta = {
  ip: string;
  userAgent: string;
  referrer?: string | null;
};

function serializePromotionBase(row: Promotion): Omit<SerializedPromotion, "clickCount" | "visitCount" | "uniqueVisits" | "signupCount"> {
  return {
    id: row.id,
    name: row.name,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmContent: row.utmContent,
    utmTerm: row.utmTerm,
    landingPath: row.landingPath,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function utmWhereFromFields(fields: PromotionUtmFields): Prisma.PromotionWhereInput {
  return {
    utmSource: fields.utmSource,
    utmMedium: fields.utmMedium,
    utmCampaign: fields.utmCampaign,
    utmContent: fields.utmContent,
    utmTerm: fields.utmTerm,
    isActive: true,
  };
}

function normalizePromotionInput(input: PromotionInput) {
  const utmSource = sanitizeUtmValue(input.utmSource);
  const utmCampaign = sanitizeUtmValue(input.utmCampaign);
  if (!utmSource || !utmCampaign) {
    throw Errors.validation("utmSource and utmCampaign are required.");
  }

  return {
    name: input.name.trim(),
    utmSource,
    utmMedium: sanitizeUtmValue(input.utmMedium),
    utmCampaign,
    utmContent: sanitizeUtmValue(input.utmContent),
    utmTerm: sanitizeUtmValue(input.utmTerm),
    landingPath: input.landingPath?.trim() || "/",
    isActive: input.isActive ?? true,
  };
}

export async function listPromotions(): Promise<SerializedPromotion[]> {
  const [promotions, clickCounts, visitCounts, signupCounts, uniqueVisitGroups] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.promotionEvent.groupBy({
      by: ["promotionId"],
      where: { eventType: "CLICK", promotionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.promotionEvent.groupBy({
      by: ["promotionId"],
      where: { eventType: "VISIT", promotionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.groupBy({
      by: ["promotionId"],
      where: { role: "ADVERTISER", promotionId: { not: null } },
      _count: { _all: true },
    }),
    prisma.promotionEvent.findMany({
      where: { eventType: "VISIT", promotionId: { not: null }, visitorKey: { not: null } },
      select: { promotionId: true, visitorKey: true },
      distinct: ["promotionId", "visitorKey"],
    }),
  ]);

  const clicksByPromotion = new Map(
    clickCounts.map((row) => [row.promotionId!, row._count._all]),
  );
  const visitsByPromotion = new Map(
    visitCounts.map((row) => [row.promotionId!, row._count._all]),
  );
  const signupsByPromotion = new Map(
    signupCounts.map((row) => [row.promotionId!, row._count._all]),
  );
  const uniqueByPromotion = new Map<string, number>();
  for (const row of uniqueVisitGroups) {
    if (!row.promotionId || !row.visitorKey) continue;
    uniqueByPromotion.set(row.promotionId, (uniqueByPromotion.get(row.promotionId) ?? 0) + 1);
  }

  return promotions.map((promotion) => ({
    ...serializePromotionBase(promotion),
    clickCount: clicksByPromotion.get(promotion.id) ?? 0,
    visitCount: visitsByPromotion.get(promotion.id) ?? 0,
    uniqueVisits: uniqueByPromotion.get(promotion.id) ?? 0,
    signupCount: signupsByPromotion.get(promotion.id) ?? 0,
  }));
}

export async function createPromotion(input: PromotionInput, createdById?: string | null) {
  const data = normalizePromotionInput(input);
  const row = await prisma.promotion.create({
    data: {
      ...data,
      createdById: createdById ?? null,
    },
  });
  return {
    ...serializePromotionBase(row),
    clickCount: 0,
    visitCount: 0,
    uniqueVisits: 0,
    signupCount: 0,
  };
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Promotion");

  const data: Prisma.PromotionUpdateInput = {};
  if (input.name !== undefined) data.name = input.name.trim();
  if (input.utmSource !== undefined) data.utmSource = sanitizeUtmValue(input.utmSource) ?? existing.utmSource;
  if (input.utmMedium !== undefined) data.utmMedium = sanitizeUtmValue(input.utmMedium);
  if (input.utmCampaign !== undefined) data.utmCampaign = sanitizeUtmValue(input.utmCampaign) ?? existing.utmCampaign;
  if (input.utmContent !== undefined) data.utmContent = sanitizeUtmValue(input.utmContent);
  if (input.utmTerm !== undefined) data.utmTerm = sanitizeUtmValue(input.utmTerm);
  if (input.landingPath !== undefined) data.landingPath = input.landingPath.trim() || "/";
  if (input.isActive !== undefined) data.isActive = input.isActive;

  const row = await prisma.promotion.update({ where: { id }, data });
  return serializePromotionBase(row);
}

export async function resolvePromotionIdByUtm(
  fields: Partial<PromotionUtmFields>,
): Promise<string | null> {
  const normalized = normalizeAttributionForStorage(fields);
  if (!normalized) return null;

  const promotion = await prisma.promotion.findFirst({
    where: utmWhereFromFields(normalized),
    select: { id: true },
  });
  return promotion?.id ?? null;
}

export async function recordPromotionClick(promotionId: string, meta: RequestMeta, origin: string) {
  const promotion = await prisma.promotion.findFirst({
    where: { id: promotionId, isActive: true },
  });
  if (!promotion) throw Errors.notFound("Promotion");

  const visitorKey = buildPromotionVisitorKey(meta.ip, meta.userAgent);
  await prisma.promotionEvent.create({
    data: {
      promotionId: promotion.id,
      eventType: "CLICK",
      utmSource: promotion.utmSource,
      utmMedium: promotion.utmMedium,
      utmCampaign: promotion.utmCampaign,
      utmContent: promotion.utmContent,
      utmTerm: promotion.utmTerm,
      landingPath: promotion.landingPath,
      landingUrl: buildPromotionUrl(origin, promotion),
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer ?? null,
      visitorKey,
    },
  });

  return buildPromotionUrl(origin, promotion);
}

export async function recordPromotionVisit(
  body: Partial<PromotionAttributionPayload>,
  meta: RequestMeta,
): Promise<{ recorded: boolean }> {
  const normalized = normalizeAttributionForStorage(body);
  if (!normalized) return { recorded: false };

  const promotionId = await resolvePromotionIdByUtm(normalized);
  const visitorKey = buildPromotionVisitorKey(meta.ip, meta.userAgent);
  const since = new Date(Date.now() - PROMO_VISIT_DEDUPE_SECONDS * 1000);

  const recentDuplicate = await prisma.promotionEvent.findFirst({
    where: {
      eventType: "VISIT",
      visitorKey,
      createdAt: { gte: since },
      OR: [
        promotionId ? { promotionId } : undefined,
        {
          utmSource: normalized.utmSource,
          utmMedium: normalized.utmMedium,
          utmCampaign: normalized.utmCampaign,
          utmContent: normalized.utmContent,
          utmTerm: normalized.utmTerm,
        },
      ].filter(Boolean) as Prisma.PromotionEventWhereInput[],
    },
    select: { id: true },
  });

  if (recentDuplicate) return { recorded: false };

  await prisma.promotionEvent.create({
    data: {
      promotionId,
      eventType: "VISIT" as PromotionEventType,
      utmSource: normalized.utmSource,
      utmMedium: normalized.utmMedium,
      utmCampaign: normalized.utmCampaign,
      utmContent: normalized.utmContent,
      utmTerm: normalized.utmTerm,
      landingPath: normalized.landingPath ?? body.landingPath ?? null,
      landingUrl: normalized.landingUrl ?? body.landingUrl ?? null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      referrer: meta.referrer ?? null,
      visitorKey,
    },
  });

  return { recorded: true };
}

export async function getAdminPromotionReport(options: {
  q?: string;
  from?: Date;
  to?: Date;
}): Promise<PromotionReport> {
  const q = options.q?.trim().toLowerCase() ?? "";
  const createdAtFilter =
    options.from || options.to
      ? {
          ...(options.from ? { gte: options.from } : {}),
          ...(options.to ? { lte: options.to } : {}),
        }
      : undefined;

  const [events, advertisers, activePromotions] = await Promise.all([
    prisma.promotionEvent.findMany({
      where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
      select: {
        eventType: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        visitorKey: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: "ADVERTISER",
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        signupUtmSource: true,
        signupUtmMedium: true,
        signupUtmCampaign: true,
        signupUtmContent: true,
        signupUtmTerm: true,
        deposits: {
          where: { status: "COMPLETED" },
          select: { amount: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.promotion.count({ where: { isActive: true } }),
  ]);

  const filteredAdvertisers = advertisers.filter((advertiser) => {
    if (!q) return true;
    const haystack = [
      advertiser.name,
      advertiser.email,
      advertiser.signupUtmSource,
      advertiser.signupUtmMedium,
      advertiser.signupUtmCampaign,
      advertiser.signupUtmContent,
      advertiser.signupUtmTerm,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  type RowAccumulator = {
    fields: PromotionUtmFields;
    clickCount: number;
    visitCount: number;
    uniqueVisitorKeys: Set<string>;
    signupCount: number;
    totalDeposits: number;
    advertisers: PromotionReportAdvertiser[];
  };

  const rows = new Map<string, RowAccumulator>();
  const getRow = (fields: PromotionUtmFields) => {
    const key = utmKeyFromFields(fields);
    let row = rows.get(key);
    if (!row) {
      row = {
        fields,
        clickCount: 0,
        visitCount: 0,
        uniqueVisitorKeys: new Set<string>(),
        signupCount: 0,
        totalDeposits: 0,
        advertisers: [],
      };
      rows.set(key, row);
    }
    return row;
  };

  let totalClicks = 0;
  let totalVisits = 0;
  const globalUniqueVisitors = new Set<string>();

  for (const event of events) {
    if (!event.utmSource || !event.utmCampaign) continue;
    const fields: PromotionUtmFields = {
      utmSource: event.utmSource,
      utmMedium: event.utmMedium,
      utmCampaign: event.utmCampaign,
      utmContent: event.utmContent,
      utmTerm: event.utmTerm,
    };
    const row = getRow(fields);
    if (event.eventType === "CLICK") {
      row.clickCount += 1;
      totalClicks += 1;
    } else if (event.eventType === "VISIT") {
      row.visitCount += 1;
      totalVisits += 1;
      if (event.visitorKey) {
        row.uniqueVisitorKeys.add(event.visitorKey);
        globalUniqueVisitors.add(event.visitorKey);
      }
    }
  }

  let attributedSignups = 0;
  let unattributedSignups = 0;
  let attributedDeposits = 0;

  for (const advertiser of filteredAdvertisers) {
    const depositTotal = advertiser.deposits.reduce(
      (sum, deposit) => sum + Number(deposit.amount),
      0,
    );

    if (!advertiser.signupUtmSource || !advertiser.signupUtmCampaign) {
      unattributedSignups += 1;
      continue;
    }

    const fields: PromotionUtmFields = {
      utmSource: advertiser.signupUtmSource,
      utmMedium: advertiser.signupUtmMedium,
      utmCampaign: advertiser.signupUtmCampaign,
      utmContent: advertiser.signupUtmContent,
      utmTerm: advertiser.signupUtmTerm,
    };
    const row = getRow(fields);
    row.signupCount += 1;
    row.totalDeposits += depositTotal;
    row.advertisers.push({
      id: advertiser.id,
      name: advertiser.name,
      email: advertiser.email,
      status: advertiser.status,
      signupAt: advertiser.createdAt.toISOString(),
      createdAt: advertiser.createdAt,
      depositTotal,
    });
    attributedSignups += 1;
    attributedDeposits += depositTotal;
  }

  const reportRows: PromotionReportRow[] = Array.from(rows.values())
    .map((row) => ({
      key: utmKeyFromFields(row.fields),
      ...row.fields,
      clickCount: row.clickCount,
      visitCount: row.visitCount,
      uniqueVisits: row.uniqueVisitorKeys.size,
      signupCount: row.signupCount,
      signupRate: calculateSignupRate(row.signupCount, row.visitCount),
      totalDeposits: row.totalDeposits,
      avgDeposit:
        row.signupCount > 0 ? Math.round((row.totalDeposits / row.signupCount) * 100) / 100 : null,
      advertisers: row.advertisers,
    }))
    .sort((a, b) => {
      if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
      if (b.clickCount !== a.clickCount) return b.clickCount - a.clickCount;
      if (b.signupCount !== a.signupCount) return b.signupCount - a.signupCount;
      return b.totalDeposits - a.totalDeposits;
    });

  return {
    stats: {
      totalClicks,
      totalVisits,
      uniqueVisitors: globalUniqueVisitors.size,
      attributedSignups,
      unattributedSignups,
      attributedDeposits,
      activePromotions,
    },
    rows: reportRows,
  };
}

export async function applySignupAttribution(
  input: Partial<PromotionAttributionPayload> | null | undefined,
): Promise<{
  promotionId: string | null;
  signupUtmSource: string | null;
  signupUtmMedium: string | null;
  signupUtmCampaign: string | null;
  signupUtmContent: string | null;
  signupUtmTerm: string | null;
  signupLandingUrl: string | null;
}> {
  const normalized = normalizeAttributionForStorage(input ?? {});
  if (!normalized) {
    return {
      promotionId: null,
      signupUtmSource: null,
      signupUtmMedium: null,
      signupUtmCampaign: null,
      signupUtmContent: null,
      signupUtmTerm: null,
      signupLandingUrl: null,
    };
  }

  const promotionId = await resolvePromotionIdByUtm(normalized);
  return {
    promotionId,
    signupUtmSource: normalized.utmSource,
    signupUtmMedium: normalized.utmMedium,
    signupUtmCampaign: normalized.utmCampaign,
    signupUtmContent: normalized.utmContent,
    signupUtmTerm: normalized.utmTerm,
    signupLandingUrl: normalized.landingUrl ?? null,
  };
}
