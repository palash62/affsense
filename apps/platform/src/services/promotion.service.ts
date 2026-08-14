import { prisma } from "@/lib/prisma";
import {
  buildPromotionUrl,
  normalizeAttributionForStorage,
  normalizeUtmTemplate,
  type PromotionAttribution,
  sanitizeUtmValue,
  utmKeyFromFields,
} from "@/lib/promotion-attribution";
import { buildPromotionVisitorKey } from "@/lib/promotion-visitor-key";

export type PromotionRecord = {
  id: string;
  name: string;
  utmSource: string;
  utmMedium: string | null;
  utmCampaign: string;
  utmContent: string | null;
  utmTerm: string | null;
  landingPath: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PromotionRecordWithStats = PromotionRecord & {
  clickCount: number;
  visitCount: number;
  uniqueVisits: number;
  signupCount: number;
};

export type PromotionRequestMeta = {
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  visitorKey?: string | null;
};

export type AdminPromotionReportRow = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  clickCount: number;
  visitCount: number;
  uniqueVisits: number;
  signupCount: number;
  signupRate: number | null;
  totalDeposits: number;
  advertisers: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    createdAt: Date;
    depositTotal: number;
  }>;
};

export type AdminPromotionReport = {
  stats: {
    totalClicks: number;
    totalVisits: number;
    uniqueVisitors: number;
    attributedSignups: number;
    unattributedSignups: number;
    attributedDeposits: number;
    activePromotions: number;
  };
  rows: AdminPromotionReportRow[];
};

const VISIT_DEDUPE_MS = 30 * 60 * 1000;

function normalizeLandingPath(path: string | undefined): string {
  const trimmed = path?.trim() || "/";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed;
}

function attributionKey(attribution: {
  signupUtmSource: string | null;
  signupUtmMedium: string | null;
  signupUtmCampaign: string | null;
  signupUtmContent: string | null;
  signupUtmTerm: string | null;
}) {
  return utmKeyFromFields({
    utmSource: attribution.signupUtmSource,
    utmMedium: attribution.signupUtmMedium,
    utmCampaign: attribution.signupUtmCampaign,
    utmContent: attribution.signupUtmContent,
    utmTerm: attribution.signupUtmTerm,
  });
}

function displayUtm(value: string | null | undefined): string {
  return value?.trim() || "—";
}

function emptyReportRow(utm: {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
}): AdminPromotionReportRow {
  return {
    ...utm,
    clickCount: 0,
    visitCount: 0,
    uniqueVisits: 0,
    signupCount: 0,
    signupRate: null,
    totalDeposits: 0,
    advertisers: [],
  };
}

function computeSignupRate(signupCount: number, visitCount: number): number | null {
  if (visitCount <= 0) return null;
  return Math.round((signupCount / visitCount) * 1000) / 10;
}

async function getPromotionStatsMaps(promotionIds: string[]) {
  const clickCountByPromotion = new Map<string, number>();
  const visitCountByPromotion = new Map<string, number>();
  const uniqueVisitorsByPromotion = new Map<string, Set<string>>();
  const signupCountByPromotion = new Map<string, number>();

  if (promotionIds.length === 0) {
    return { clickCountByPromotion, visitCountByPromotion, uniqueVisitorsByPromotion, signupCountByPromotion };
  }

  const [clickGroups, visitEvents, signupGroups] = await Promise.all([
    prisma.promotionEvent.groupBy({
      by: ["promotionId"],
      where: { promotionId: { in: promotionIds }, eventType: "CLICK" },
      _count: { _all: true },
    }),
    prisma.promotionEvent.findMany({
      where: { promotionId: { in: promotionIds }, eventType: "VISIT" },
      select: { promotionId: true, visitorKey: true },
    }),
    prisma.user.groupBy({
      by: ["promotionId"],
      where: { promotionId: { in: promotionIds }, role: "ADVERTISER" },
      _count: { _all: true },
    }),
  ]);

  for (const row of clickGroups) {
    if (row.promotionId) clickCountByPromotion.set(row.promotionId, row._count._all);
  }

  for (const event of visitEvents) {
    if (!event.promotionId) continue;
    visitCountByPromotion.set(
      event.promotionId,
      (visitCountByPromotion.get(event.promotionId) ?? 0) + 1,
    );
    if (event.visitorKey) {
      const visitors =
        uniqueVisitorsByPromotion.get(event.promotionId) ?? new Set<string>();
      visitors.add(event.visitorKey);
      uniqueVisitorsByPromotion.set(event.promotionId, visitors);
    }
  }

  for (const row of signupGroups) {
    if (row.promotionId) signupCountByPromotion.set(row.promotionId, row._count._all);
  }

  return { clickCountByPromotion, visitCountByPromotion, uniqueVisitorsByPromotion, signupCountByPromotion };
}

export async function listPromotions(): Promise<PromotionRecordWithStats[]> {
  const promotions = await prisma.promotion.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  const promotionIds = promotions.map((promotion) => promotion.id);
  const {
    clickCountByPromotion,
    visitCountByPromotion,
    uniqueVisitorsByPromotion,
    signupCountByPromotion,
  } = await getPromotionStatsMaps(promotionIds);

  return promotions.map((promotion) => ({
    ...promotion,
    clickCount: clickCountByPromotion.get(promotion.id) ?? 0,
    visitCount: visitCountByPromotion.get(promotion.id) ?? 0,
    uniqueVisits: uniqueVisitorsByPromotion.get(promotion.id)?.size ?? 0,
    signupCount: signupCountByPromotion.get(promotion.id) ?? 0,
  }));
}

export async function createPromotion(
  input: {
    name: string;
    utmSource: string;
    utmMedium?: string;
    utmCampaign: string;
    utmContent?: string;
    utmTerm?: string;
    landingPath?: string;
  },
  createdById?: string,
): Promise<PromotionRecord> {
  return prisma.promotion.create({
    data: {
      name: input.name.trim(),
      utmSource: normalizeUtmTemplate(input.utmSource) ?? input.utmSource.trim(),
      utmMedium: normalizeUtmTemplate(input.utmMedium) ?? null,
      utmCampaign: normalizeUtmTemplate(input.utmCampaign) ?? input.utmCampaign.trim(),
      utmContent: normalizeUtmTemplate(input.utmContent) ?? null,
      utmTerm: normalizeUtmTemplate(input.utmTerm) ?? null,
      landingPath: normalizeLandingPath(input.landingPath),
      createdById,
    },
  });
}

export async function updatePromotion(
  id: string,
  input: {
    name?: string;
    utmSource?: string;
    utmMedium?: string | null;
    utmCampaign?: string;
    utmContent?: string | null;
    utmTerm?: string | null;
    landingPath?: string;
    isActive?: boolean;
  },
): Promise<PromotionRecord> {
  return prisma.promotion.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.utmSource !== undefined
        ? { utmSource: normalizeUtmTemplate(input.utmSource) ?? input.utmSource.trim() }
        : {}),
      ...(input.utmMedium !== undefined
        ? { utmMedium: input.utmMedium ? normalizeUtmTemplate(input.utmMedium) ?? null : null }
        : {}),
      ...(input.utmCampaign !== undefined
        ? { utmCampaign: normalizeUtmTemplate(input.utmCampaign) ?? input.utmCampaign.trim() }
        : {}),
      ...(input.utmContent !== undefined
        ? { utmContent: input.utmContent ? normalizeUtmTemplate(input.utmContent) ?? null : null }
        : {}),
      ...(input.utmTerm !== undefined
        ? { utmTerm: input.utmTerm ? normalizeUtmTemplate(input.utmTerm) ?? null : null }
        : {}),
      ...(input.landingPath !== undefined
        ? { landingPath: normalizeLandingPath(input.landingPath) }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function resolvePromotionId(attribution: PromotionAttribution | null): Promise<string | null> {
  if (!attribution?.utmSource || !attribution.utmCampaign) return null;

  const utmSource = sanitizeUtmValue(attribution.utmSource);
  const utmCampaign = sanitizeUtmValue(attribution.utmCampaign);
  const utmMedium = sanitizeUtmValue(attribution.utmMedium) ?? null;
  const utmContent = sanitizeUtmValue(attribution.utmContent) ?? null;
  const utmTerm = sanitizeUtmValue(attribution.utmTerm) ?? null;

  if (!utmSource || !utmCampaign) return null;

  const promotion = await prisma.promotion.findFirst({
    where: {
      isActive: true,
      utmSource,
      utmCampaign,
      utmMedium,
      utmContent,
      utmTerm,
    },
    select: { id: true },
  });

  return promotion?.id ?? null;
}

export function buildPromotionLink(origin: string, promotion: PromotionRecord): string {
  return buildPromotionUrl(origin, promotion, { promotionId: promotion.id });
}

export async function recordPromotionClick(
  promotionId: string,
  meta: PromotionRequestMeta,
): Promise<PromotionRecord | null> {
  const promotion = await prisma.promotion.findFirst({
    where: { id: promotionId, isActive: true },
  });
  if (!promotion) return null;

  const visitorKey =
    meta.visitorKey ?? buildPromotionVisitorKey(meta.ip ?? null, meta.userAgent ?? null);

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
      ip: meta.ip?.slice(0, 191) ?? null,
      userAgent: meta.userAgent?.slice(0, 1000) ?? null,
      referrer: meta.referrer?.slice(0, 2000) ?? null,
      visitorKey,
    },
  });

  return promotion;
}

export async function recordPromotionVisit(
  attribution: PromotionAttribution,
  meta: PromotionRequestMeta & { landingPath?: string; landingUrl?: string },
): Promise<{ recorded: boolean }> {
  const normalized = normalizeAttributionForStorage(attribution);
  if (!normalized) return { recorded: false };

  const promotionId = await resolvePromotionId(normalized);
  const visitorKey =
    meta.visitorKey ?? buildPromotionVisitorKey(meta.ip ?? null, meta.userAgent ?? null);

  const dedupeSince = new Date(Date.now() - VISIT_DEDUPE_MS);
  const recentVisit = await prisma.promotionEvent.findFirst({
    where: {
      eventType: "VISIT",
      visitorKey,
      createdAt: { gte: dedupeSince },
      ...(promotionId
        ? { promotionId }
        : {
            promotionId: null,
            utmSource: normalized.utmSource ?? null,
            utmMedium: normalized.utmMedium ?? null,
            utmCampaign: normalized.utmCampaign ?? null,
            utmContent: normalized.utmContent ?? null,
            utmTerm: normalized.utmTerm ?? null,
          }),
    },
    select: { id: true },
  });

  if (recentVisit) return { recorded: false };

  await prisma.promotionEvent.create({
    data: {
      promotionId,
      eventType: "VISIT",
      utmSource: normalized.utmSource ?? null,
      utmMedium: normalized.utmMedium ?? null,
      utmCampaign: normalized.utmCampaign ?? null,
      utmContent: normalized.utmContent ?? null,
      utmTerm: normalized.utmTerm ?? null,
      landingPath: meta.landingPath?.slice(0, 200) ?? null,
      landingUrl: meta.landingUrl?.slice(0, 2000) ?? null,
      ip: meta.ip?.slice(0, 191) ?? null,
      userAgent: meta.userAgent?.slice(0, 1000) ?? null,
      referrer: meta.referrer?.slice(0, 2000) ?? null,
      visitorKey,
    },
  });

  return { recorded: true };
}

export async function getAdminPromotionReport(options?: {
  q?: string;
  from?: string;
  to?: string;
}): Promise<AdminPromotionReport> {
  const q = options?.q?.trim();
  const fromDate = options?.from ? new Date(options.from) : undefined;
  const toDate = options?.to ? new Date(options.to) : undefined;

  const createdAtFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const advertisers = await prisma.user.findMany({
    where: {
      role: "ADVERTISER",
      ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { signupUtmSource: { contains: q } },
              { signupUtmCampaign: { contains: q } },
            ],
          }
        : {}),
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
    },
    orderBy: { createdAt: "desc" },
  });

  const events = await prisma.promotionEvent.findMany({
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
  });

  const advertiserIds = advertisers.map((user) => user.id);
  const depositGroups =
    advertiserIds.length > 0
      ? await prisma.deposit.groupBy({
          by: ["userId"],
          where: {
            userId: { in: advertiserIds },
            status: "COMPLETED",
          },
          _sum: { amount: true },
        })
      : [];

  const depositByUser = new Map<string, number>();
  for (const row of depositGroups) {
    depositByUser.set(row.userId, Number(row._sum.amount ?? 0));
  }

  const rowMap = new Map<string, AdminPromotionReportRow>();
  const uniqueVisitorsByKey = new Map<string, Set<string>>();
  let attributedSignups = 0;
  let unattributedSignups = 0;
  let attributedDeposits = 0;
  let totalClicks = 0;
  let totalVisits = 0;
  const globalUniqueVisitors = new Set<string>();

  for (const event of events) {
    const key = utmKeyFromFields(event);
    const existing = rowMap.get(key);
    const row =
      existing ??
      emptyReportRow({
        utmSource: displayUtm(event.utmSource),
        utmMedium: displayUtm(event.utmMedium),
        utmCampaign: displayUtm(event.utmCampaign),
        utmContent: displayUtm(event.utmContent),
        utmTerm: displayUtm(event.utmTerm),
      });

    if (event.eventType === "CLICK") {
      row.clickCount += 1;
      totalClicks += 1;
    }

    if (event.eventType === "VISIT") {
      row.visitCount += 1;
      totalVisits += 1;
      if (event.visitorKey) {
        globalUniqueVisitors.add(event.visitorKey);
        const visitors = uniqueVisitorsByKey.get(key) ?? new Set<string>();
        visitors.add(event.visitorKey);
        uniqueVisitorsByKey.set(key, visitors);
      }
    }

    if (!existing) rowMap.set(key, row);
  }

  for (const [key, row] of rowMap) {
    row.uniqueVisits = uniqueVisitorsByKey.get(key)?.size ?? 0;
    row.signupRate = computeSignupRate(row.signupCount, row.visitCount);
  }

  for (const advertiser of advertisers) {
    const depositTotal = depositByUser.get(advertiser.id) ?? 0;
    const hasAttribution = Boolean(
      advertiser.signupUtmSource ||
        advertiser.signupUtmMedium ||
        advertiser.signupUtmCampaign ||
        advertiser.signupUtmContent ||
        advertiser.signupUtmTerm,
    );

    if (!hasAttribution) {
      unattributedSignups += 1;
      continue;
    }

    attributedSignups += 1;
    attributedDeposits += depositTotal;

    const key = attributionKey(advertiser);
    const existing = rowMap.get(key);
    const advertiserRow = {
      id: advertiser.id,
      name: advertiser.name,
      email: advertiser.email,
      status: advertiser.status,
      createdAt: advertiser.createdAt,
      depositTotal,
    };

    if (existing) {
      existing.signupCount += 1;
      existing.totalDeposits += depositTotal;
      existing.advertisers.push(advertiserRow);
      existing.signupRate = computeSignupRate(existing.signupCount, existing.visitCount);
    } else {
      rowMap.set(key, {
        utmSource: displayUtm(advertiser.signupUtmSource),
        utmMedium: displayUtm(advertiser.signupUtmMedium),
        utmCampaign: displayUtm(advertiser.signupUtmCampaign),
        utmContent: displayUtm(advertiser.signupUtmContent),
        utmTerm: displayUtm(advertiser.signupUtmTerm),
        clickCount: 0,
        visitCount: 0,
        uniqueVisits: 0,
        signupCount: 1,
        signupRate: null,
        totalDeposits: depositTotal,
        advertisers: [advertiserRow],
      });
    }
  }

  for (const row of rowMap.values()) {
    row.signupRate = computeSignupRate(row.signupCount, row.visitCount);
  }

  const activePromotions = await prisma.promotion.count({ where: { isActive: true } });

  const rows = Array.from(rowMap.values()).sort((a, b) => {
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
    rows,
  };
}

export function signupAttributionToUserFields(
  attribution: PromotionAttribution | null,
  promotionId: string | null,
) {
  if (!attribution) return {};
  return {
    signupUtmSource: attribution.utmSource ?? null,
    signupUtmMedium: attribution.utmMedium ?? null,
    signupUtmCampaign: attribution.utmCampaign ?? null,
    signupUtmContent: attribution.utmContent ?? null,
    signupUtmTerm: attribution.utmTerm ?? null,
    signupLandingUrl: attribution.landingUrl ?? null,
    promotionId,
  };
}

export function parseSignupAttributionFromRequest(
  input: PromotionAttribution | null | undefined,
): PromotionAttribution | null {
  return normalizeAttributionForStorage(input);
}
