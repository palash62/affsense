import { prisma } from "@/lib/prisma";
import {
  buildPromotionUrl,
  normalizeAttributionForStorage,
  type PromotionAttribution,
  sanitizeUtmValue,
} from "@/lib/promotion-attribution";

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

export type AdminPromotionReportRow = {
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  signupCount: number;
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
    attributedSignups: number;
    unattributedSignups: number;
    attributedDeposits: number;
    activePromotions: number;
  };
  rows: AdminPromotionReportRow[];
};

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
  return [
    attribution.signupUtmSource ?? "",
    attribution.signupUtmMedium ?? "",
    attribution.signupUtmCampaign ?? "",
    attribution.signupUtmContent ?? "",
    attribution.signupUtmTerm ?? "",
  ].join("|");
}

function displayUtm(value: string | null | undefined): string {
  return value?.trim() || "—";
}

export async function listPromotions(): Promise<PromotionRecord[]> {
  return prisma.promotion.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
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
      utmSource: sanitizeUtmValue(input.utmSource) ?? input.utmSource.trim(),
      utmMedium: sanitizeUtmValue(input.utmMedium) ?? null,
      utmCampaign: sanitizeUtmValue(input.utmCampaign) ?? input.utmCampaign.trim(),
      utmContent: sanitizeUtmValue(input.utmContent) ?? null,
      utmTerm: sanitizeUtmValue(input.utmTerm) ?? null,
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
        ? { utmSource: sanitizeUtmValue(input.utmSource) ?? input.utmSource.trim() }
        : {}),
      ...(input.utmMedium !== undefined
        ? { utmMedium: input.utmMedium ? sanitizeUtmValue(input.utmMedium) ?? null : null }
        : {}),
      ...(input.utmCampaign !== undefined
        ? { utmCampaign: sanitizeUtmValue(input.utmCampaign) ?? input.utmCampaign.trim() }
        : {}),
      ...(input.utmContent !== undefined
        ? { utmContent: input.utmContent ? sanitizeUtmValue(input.utmContent) ?? null : null }
        : {}),
      ...(input.utmTerm !== undefined
        ? { utmTerm: input.utmTerm ? sanitizeUtmValue(input.utmTerm) ?? null : null }
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
  return buildPromotionUrl(origin, promotion);
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
  let attributedSignups = 0;
  let unattributedSignups = 0;
  let attributedDeposits = 0;

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
    } else {
      rowMap.set(key, {
        utmSource: displayUtm(advertiser.signupUtmSource),
        utmMedium: displayUtm(advertiser.signupUtmMedium),
        utmCampaign: displayUtm(advertiser.signupUtmCampaign),
        utmContent: displayUtm(advertiser.signupUtmContent),
        utmTerm: displayUtm(advertiser.signupUtmTerm),
        signupCount: 1,
        totalDeposits: depositTotal,
        advertisers: [advertiserRow],
      });
    }
  }

  const activePromotions = await prisma.promotion.count({ where: { isActive: true } });

  const rows = Array.from(rowMap.values()).sort((a, b) => {
    if (b.signupCount !== a.signupCount) return b.signupCount - a.signupCount;
    return b.totalDeposits - a.totalDeposits;
  });

  return {
    stats: {
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
