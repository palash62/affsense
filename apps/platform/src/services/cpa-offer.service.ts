import { randomBytes } from "node:crypto";
import {
  Prisma,
  type CpaOffer,
  type CpaOfferStatus,
  type CpaOfferVisibility,
  type PublisherCpaOfferAccessStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { parseUserAgent } from "@/lib/publisher-leads";
import {
  cpaOfferDetailsToJson,
  parseCpaOfferDetails,
  type CpaOfferDetails,
} from "@/lib/cpa-offer-details";

export type CpaRevenueModel = "RPA" | "RPS" | "RPC" | "RPI" | "RPL" | "RPM";
export type CpaPayoutModel = "CPC" | "CPA" | "CPS" | "CPI" | "CPL" | "CPM";
export type CpaPayoutType = "FLAT" | "PERCENT";
export type PublisherCpaOfferAccessState = PublisherCpaOfferAccessStatus | null;

export type SerializedCpaOffer = {
  id: string;
  name: string;
  network: string;
  category: string;
  country: string;
  previewUrl: string;
  trackingUrl: string;
  thumbnailUrl: string | null;
  advertiserLabel: string;
  description: string | null;
  details: CpaOfferDetails;
  createdByUserId: string | null;
  ownerAdvertiserId: string | null;
  ownerAdvertiserName: string | null;
  revenueModel: CpaRevenueModel;
  payoutModel: CpaPayoutModel;
  payoutType: CpaPayoutType;
  revenue: string;
  payout: string;
  status: CpaOfferStatus;
  visibility: CpaOfferVisibility;
  /** Kept for legacy /pbtr/{token} compatibility; not shown in UI. */
  postbackToken: string;
  createdAt: string;
  updatedAt: string;
};

export type SerializedPublisherCpaOffer = SerializedCpaOffer & {
  accessStatus: PublisherCpaOfferAccessState;
  adminNote: string | null;
  canPromote: boolean;
};

export type PublisherCpaOfferListResult = {
  items: SerializedPublisherCpaOffer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CpaOfferListResult = {
  items: SerializedCpaOffer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CpaOfferListFilters = {
  q?: string;
  id?: string;
  status?: CpaOfferStatus | "ALL";
  network?: string;
  category?: string;
  country?: string;
  page?: number;
  limit?: number;
};

function decimalToString(value: { toString(): string } | number | string) {
  return typeof value === "string" ? value : value.toString();
}

function asRevenueModel(value: string): CpaRevenueModel {
  const allowed: CpaRevenueModel[] = ["RPA", "RPS", "RPC", "RPI", "RPL", "RPM"];
  return (allowed.includes(value as CpaRevenueModel) ? value : "RPA") as CpaRevenueModel;
}

function asPayoutModel(value: string): CpaPayoutModel {
  const allowed: CpaPayoutModel[] = ["CPC", "CPA", "CPS", "CPI", "CPL", "CPM"];
  return (allowed.includes(value as CpaPayoutModel) ? value : "CPA") as CpaPayoutModel;
}

function asPayoutType(value: string): CpaPayoutType {
  return value === "PERCENT" ? "PERCENT" : "FLAT";
}

export function serializeCpaOffer(
  row: CpaOffer & {
    description?: string | null;
    details?: Prisma.JsonValue | null;
    createdByUserId?: string | null;
    ownerAdvertiserId?: string | null;
    ownerAdvertiser?: { name: string; advertiserProfile?: { company: string } | null } | null;
  },
): SerializedCpaOffer {
  const ownerName =
    row.ownerAdvertiser?.advertiserProfile?.company?.trim() ||
    row.ownerAdvertiser?.name?.trim() ||
    null;
  return {
    id: row.id,
    name: row.name,
    network: row.network,
    category: row.category,
    country: row.country,
    previewUrl: row.previewUrl,
    trackingUrl: row.trackingUrl,
    thumbnailUrl: row.thumbnailUrl ?? null,
    advertiserLabel: row.advertiserLabel || "Platform",
    description: row.description ?? null,
    details: parseCpaOfferDetails(row.details),
    createdByUserId: row.createdByUserId ?? null,
    ownerAdvertiserId: row.ownerAdvertiserId ?? null,
    ownerAdvertiserName: ownerName,
    revenueModel: asRevenueModel(row.revenueModel),
    payoutModel: asPayoutModel(row.payoutModel),
    payoutType: asPayoutType(row.payoutType),
    revenue: decimalToString(row.revenue),
    payout: decimalToString(row.payout),
    status: row.status,
    visibility: row.visibility ?? "PUBLIC",
    postbackToken: row.postbackToken,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildWhere(
  filters: CpaOfferListFilters,
  options?: { activeOnly?: boolean },
): Prisma.CpaOfferWhereInput {
  const where: Prisma.CpaOfferWhereInput = {};

  if (options?.activeOnly) {
    where.status = "ACTIVE";
  } else if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  const id = filters.id?.trim();
  if (id) where.id = { contains: id };

  const network = filters.network?.trim();
  if (network) where.network = { contains: network };

  const category = filters.category?.trim();
  if (category) where.category = { contains: category };

  const country = filters.country?.trim();
  if (country) where.country = { contains: country };

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { network: { contains: q } },
      { category: { contains: q } },
      { country: { contains: q } },
      { advertiserLabel: { contains: q } },
      { id: { contains: q } },
    ];
  }

  return where;
}

async function listCpaOffers(
  filters: CpaOfferListFilters,
  options?: { activeOnly?: boolean; ownerAdvertiserId?: string },
): Promise<CpaOfferListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where = buildWhere(filters, options);
  if (options?.ownerAdvertiserId) {
    where.ownerAdvertiserId = options.ownerAdvertiserId;
  }

  const [total, rows] = await Promise.all([
    prisma.cpaOffer.count({ where }),
    prisma.cpaOffer.findMany({
      where,
      include: {
        ownerAdvertiser: {
          select: { name: true, advertiserProfile: { select: { company: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: rows.map(serializeCpaOffer),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function listCpaOffersForAdmin(filters: CpaOfferListFilters) {
  return listCpaOffers(filters);
}

export function listActiveCpaOffers(filters: CpaOfferListFilters) {
  return listCpaOffers(filters, { activeOnly: true });
}

export function listCpaOffersForAdvertiserOwner(
  advertiserId: string,
  filters: CpaOfferListFilters,
) {
  return listCpaOffers(filters, { activeOnly: true, ownerAdvertiserId: advertiserId });
}

function resolvePublisherAccess(
  visibility: CpaOfferVisibility,
  access: { status: PublisherCpaOfferAccessStatus; adminNote: string | null } | null | undefined,
) {
  if (visibility === "PUBLIC") {
    return {
      accessStatus: null as PublisherCpaOfferAccessState,
      adminNote: null,
      canPromote: true,
    };
  }

  const accessStatus = access?.status ?? null;
  return {
    accessStatus,
    adminNote: accessStatus === "REJECTED" ? access?.adminNote ?? null : null,
    canPromote: accessStatus === "APPROVED",
  };
}

function serializePublisherCpaOffer(
  row: CpaOffer & {
    description?: string | null;
    details?: Prisma.JsonValue | null;
    createdByUserId?: string | null;
  },
  access: { status: PublisherCpaOfferAccessStatus; adminNote: string | null } | null | undefined,
): SerializedPublisherCpaOffer {
  const base = serializeCpaOffer(row);
  const resolved = resolvePublisherAccess(base.visibility, access);
  return {
    ...base,
    ...resolved,
  };
}

export async function listPublisherCpaOffers(
  publisherId: string,
  filters: CpaOfferListFilters,
): Promise<PublisherCpaOfferListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where = buildWhere(filters, { activeOnly: true });

  const [total, rows] = await Promise.all([
    prisma.cpaOffer.count({ where }),
    prisma.cpaOffer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const offerIds = rows.map((row) => row.id);
  const accessRows =
    offerIds.length === 0
      ? []
      : await prisma.publisherCpaOfferAccess.findMany({
          where: { publisherId, offerId: { in: offerIds } },
          select: { offerId: true, status: true, adminNote: true },
        });
  const accessByOfferId = new Map(accessRows.map((row) => [row.offerId, row]));

  return {
    items: rows.map((row) => serializePublisherCpaOffer(row, accessByOfferId.get(row.id))),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function publisherCanPromoteCpaOffer(
  publisherId: string,
  offerId: string,
): Promise<boolean> {
  const offer = await prisma.cpaOffer.findFirst({
    where: { id: offerId, status: "ACTIVE" },
    select: { id: true, visibility: true },
  });
  if (!offer) return false;
  if (offer.visibility === "PUBLIC") return true;

  const access = await prisma.publisherCpaOfferAccess.findUnique({
    where: { publisherId_offerId: { publisherId, offerId } },
    select: { status: true },
  });
  return access?.status === "APPROVED";
}

export async function requestPublisherCpaOfferAccess(publisherId: string, offerId: string) {
  const offer = await prisma.cpaOffer.findFirst({
    where: { id: offerId, status: "ACTIVE", visibility: "PRIVATE" },
    select: { id: true, name: true },
  });
  if (!offer) throw Errors.notFound("CPA offer");

  const row = await prisma.publisherCpaOfferAccess.upsert({
    where: { publisherId_offerId: { publisherId, offerId } },
    create: {
      publisherId,
      offerId,
      status: "PENDING",
      adminNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
    },
    update: {
      status: "PENDING",
      adminNote: null,
      reviewedByUserId: null,
      reviewedAt: null,
    },
  });

  return {
    id: row.id,
    offerId: row.offerId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export type CpaOfferAccessRequestFilters = {
  status?: PublisherCpaOfferAccessStatus | "ALL";
  page?: number;
  limit?: number;
};

export type SerializedCpaOfferAccessRequest = {
  id: string;
  status: PublisherCpaOfferAccessStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publisher: { id: string; name: string; email: string };
  offer: { id: string; name: string; visibility: CpaOfferVisibility };
  reviewedBy: { id: string; name: string } | null;
};

export type CpaOfferAccessRequestListResult = {
  items: SerializedCpaOfferAccessRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function listCpaOfferAccessRequests(
  filters: CpaOfferAccessRequestFilters,
): Promise<CpaOfferAccessRequestListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where: Prisma.PublisherCpaOfferAccessWhereInput = {};
  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status;
  }

  const [total, rows] = await Promise.all([
    prisma.publisherCpaOfferAccess.count({ where }),
    prisma.publisherCpaOfferAccess.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        publisher: { select: { id: true, name: true, email: true } },
        offer: { select: { id: true, name: true, visibility: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      status: row.status,
      adminNote: row.adminNote,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      publisher: row.publisher,
      offer: row.offer,
      reviewedBy: row.reviewedBy,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function reviewCpaOfferAccessRequest(
  adminId: string,
  accessId: string,
  decision: "APPROVED" | "REJECTED",
  adminNote?: string,
) {
  const existing = await prisma.publisherCpaOfferAccess.findUnique({
    where: { id: accessId },
    include: { offer: { select: { visibility: true } } },
  });
  if (!existing) throw Errors.notFound("Access request");
  if (existing.status !== "PENDING") {
    throw Errors.validation("This request has already been reviewed");
  }
  if (decision === "REJECTED" && !adminNote?.trim()) {
    throw Errors.validation("A rejection note is required");
  }

  const row = await prisma.publisherCpaOfferAccess.update({
    where: { id: accessId },
    data: {
      status: decision,
      adminNote: decision === "REJECTED" ? adminNote!.trim() : null,
      reviewedByUserId: adminId,
      reviewedAt: new Date(),
    },
    include: {
      publisher: { select: { id: true, name: true, email: true } },
      offer: { select: { id: true, name: true, visibility: true } },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  return {
    id: row.id,
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publisher: row.publisher,
    offer: row.offer,
    reviewedBy: row.reviewedBy,
  };
}

export async function getCpaOfferById(id: string): Promise<SerializedCpaOffer> {
  const row = await prisma.cpaOffer.findUnique({
    where: { id },
    include: {
      ownerAdvertiser: {
        select: { name: true, advertiserProfile: { select: { company: true } } },
      },
    },
  });
  if (!row) throw Errors.notFound("CPA offer");
  return serializeCpaOffer(row);
}

export async function getActiveCpaOfferById(id: string): Promise<SerializedCpaOffer> {
  const row = await prisma.cpaOffer.findFirst({
    where: { id, status: "ACTIVE" },
    include: {
      ownerAdvertiser: {
        select: { name: true, advertiserProfile: { select: { company: true } } },
      },
    },
  });
  if (!row) throw Errors.notFound("CPA offer");
  return serializeCpaOffer(row);
}

export async function getActiveCpaOfferForAdvertiserOwner(
  id: string,
  advertiserId: string,
): Promise<SerializedCpaOffer> {
  const row = await prisma.cpaOffer.findFirst({
    where: { id, status: "ACTIVE", ownerAdvertiserId: advertiserId },
    include: {
      ownerAdvertiser: {
        select: { name: true, advertiserProfile: { select: { company: true } } },
      },
    },
  });
  if (!row) throw Errors.notFound("CPA offer");
  return serializeCpaOffer(row);
}

export type CpaOfferInput = {
  name: string;
  network?: string;
  category: string;
  country?: string;
  previewUrl?: string;
  trackingUrl: string;
  thumbnailUrl?: string | null;
  advertiserLabel?: string;
  description?: string | null;
  details?: CpaOfferDetails | null;
  createdByUserId?: string | null;
  ownerAdvertiserId?: string | null;
  revenueModel?: CpaRevenueModel;
  payoutModel?: CpaPayoutModel;
  payoutType?: CpaPayoutType;
  revenue: number;
  payout: number;
  status?: CpaOfferStatus;
  visibility?: CpaOfferVisibility;
};

async function resolveOwnerAdvertiserLabel(ownerAdvertiserId: string | null | undefined) {
  if (!ownerAdvertiserId?.trim()) return null;
  const user = await prisma.user.findFirst({
    where: { id: ownerAdvertiserId, role: "ADVERTISER" },
    select: {
      name: true,
      advertiserProfile: { select: { company: true } },
    },
  });
  if (!user) throw Errors.validation("Invalid advertiser");
  return (user.advertiserProfile?.company?.trim() || user.name.trim() || "Advertiser").slice(0, 120);
}

export async function createCpaOffer(input: CpaOfferInput): Promise<SerializedCpaOffer> {
  const previewUrl = input.previewUrl?.trim() || "#";
  const network = input.network?.trim() || "Direct";
  const details = cpaOfferDetailsToJson(input.details);
  const ownerAdvertiserId = input.ownerAdvertiserId?.trim() || null;
  const resolvedLabel =
    (await resolveOwnerAdvertiserLabel(ownerAdvertiserId)) ||
    (input.advertiserLabel?.trim() || "Platform").slice(0, 120);

  const row = await prisma.cpaOffer.create({
    data: {
      name: input.name.trim(),
      network,
      category: input.category.trim(),
      country: input.country?.trim() || "",
      previewUrl,
      trackingUrl: input.trackingUrl.trim(),
      thumbnailUrl: input.thumbnailUrl?.trim() || null,
      advertiserLabel: resolvedLabel,
      description: input.description?.trim() || null,
      details: details === undefined ? undefined : details,
      createdByUserId: input.createdByUserId ?? null,
      ownerAdvertiserId,
      revenueModel: input.revenueModel ?? "RPA",
      payoutModel: input.payoutModel ?? "CPA",
      payoutType: input.payoutType ?? "FLAT",
      revenue: input.revenue,
      payout: input.payout,
      status: input.status ?? "PAUSED",
      visibility: input.visibility ?? "PUBLIC",
      postbackToken: randomBytes(16).toString("hex"),
    } as Prisma.CpaOfferUncheckedCreateInput,
    include: {
      ownerAdvertiser: {
        select: { name: true, advertiserProfile: { select: { company: true } } },
      },
    },
  });
  return serializeCpaOffer(row);
}

export async function updateCpaOffer(
  id: string,
  input: Partial<CpaOfferInput>,
): Promise<SerializedCpaOffer> {
  const existing = await prisma.cpaOffer.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("CPA offer");

  const details =
    input.details === undefined ? undefined : cpaOfferDetailsToJson(input.details) ?? Prisma.JsonNull;

  let ownerAdvertiserId = input.ownerAdvertiserId;
  let advertiserLabel = input.advertiserLabel;
  if (ownerAdvertiserId !== undefined) {
    const trimmed = ownerAdvertiserId?.trim() || null;
    ownerAdvertiserId = trimmed;
    if (trimmed) {
      const resolved = await resolveOwnerAdvertiserLabel(trimmed);
      if (resolved) advertiserLabel = resolved;
    }
  }

  const row = await prisma.cpaOffer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.network !== undefined ? { network: input.network.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category.trim() } : {}),
      ...(input.country !== undefined ? { country: input.country.trim() } : {}),
      ...(input.previewUrl !== undefined ? { previewUrl: input.previewUrl.trim() } : {}),
      ...(input.trackingUrl !== undefined ? { trackingUrl: input.trackingUrl.trim() } : {}),
      ...(input.thumbnailUrl !== undefined
        ? { thumbnailUrl: input.thumbnailUrl?.trim() || null }
        : {}),
      ...(advertiserLabel !== undefined
        ? { advertiserLabel: (advertiserLabel.trim() || "Platform").slice(0, 120) }
        : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(input.createdByUserId !== undefined ? { createdByUserId: input.createdByUserId } : {}),
      ...(ownerAdvertiserId !== undefined ? { ownerAdvertiserId } : {}),
      ...(input.revenueModel !== undefined ? { revenueModel: input.revenueModel } : {}),
      ...(input.payoutModel !== undefined ? { payoutModel: input.payoutModel } : {}),
      ...(input.payoutType !== undefined ? { payoutType: input.payoutType } : {}),
      ...(input.revenue !== undefined ? { revenue: input.revenue } : {}),
      ...(input.payout !== undefined ? { payout: input.payout } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    } as Prisma.CpaOfferUncheckedUpdateInput,
    include: {
      ownerAdvertiser: {
        select: { name: true, advertiserProfile: { select: { company: true } } },
      },
    },
  });
  return serializeCpaOffer(row);
}

export async function deleteCpaOffer(id: string): Promise<{ id: string }> {
  const existing = await prisma.cpaOffer.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("CPA offer");
  await prisma.cpaOffer.delete({ where: { id } });
  return { id };
}

export type CpaDashboardRange = "today" | "yesterday" | "last7d" | "thisMonth" | "lastMonth";

export type CpaDashboardSnapshot = {
  range: CpaDashboardRange;
  rangeLabel: string;
  from: string;
  to: string;
  metrics: {
    hits: number;
    clicks: number;
    hitsClicksChangePct: number;
    conversionsApproved: number;
    conversionsPending: number;
    conversionsRejected: number;
    conversionsChangePct: number;
    revenue: string;
    payout: string;
    profit: string;
    revenueChangePct: number;
    payoutChangePct: number;
    profitChangePct: number;
  };
  series: Array<{
    date: string;
    label: string;
    clicks: number;
    uniqueClicks: number;
    conversions: number;
  }>;
  newOffers: Array<{
    id: string;
    name: string;
    status: CpaOfferStatus;
    thumbnailUrl: string | null;
    payoutModel: string;
    category: string;
    payout: string;
  }>;
};

export type CpaEarningsByPeriod = {
  today: string;
  yesterday: string;
  last7d: string;
  last30d: string;
};

export type CpaDailyStatRow = {
  date: string;
  hops: number;
  sales: number;
  earnings: string;
  other: string;
};

export type AdvertiserCpaDashboardSnapshot = CpaDashboardSnapshot & {
  earningsByPeriod: CpaEarningsByPeriod;
  dailyStats: CpaDailyStatRow[];
};

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function addUtcDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function moneyToString(n: number) {
  return round2(n).toFixed(2);
}

function resolveDashboardRange(range: CpaDashboardRange): {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: string;
} {
  const now = new Date();
  const today = startOfUtcDay(now);

  if (range === "today") {
    const from = today;
    const to = endOfUtcDay(now);
    const prevFrom = addUtcDays(today, -1);
    const prevTo = endOfUtcDay(addUtcDays(today, -1));
    return { from, to, prevFrom, prevTo, label: "Today" };
  }

  if (range === "yesterday") {
    const from = addUtcDays(today, -1);
    const to = endOfUtcDay(addUtcDays(today, -1));
    const prevFrom = addUtcDays(today, -2);
    const prevTo = endOfUtcDay(addUtcDays(today, -2));
    return { from, to, prevFrom, prevTo, label: "Yesterday" };
  }

  if (range === "thisMonth") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = endOfUtcDay(now);
    const prevFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevTo = endOfUtcDay(addUtcDays(from, -1));
    return { from, to, prevFrom, prevTo, label: "This Month" };
  }

  if (range === "lastMonth") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const to = endOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));
    const prevFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
    const prevTo = endOfUtcDay(addUtcDays(from, -1));
    return { from, to, prevFrom, prevTo, label: "Last Month" };
  }

  // last7d (default)
  const from = addUtcDays(today, -6);
  const to = endOfUtcDay(now);
  const prevTo = endOfUtcDay(addUtcDays(from, -1));
  const prevFrom = addUtcDays(startOfUtcDay(prevTo), -6);
  return { from, to, prevFrom, prevTo, label: "Last 7 Days" };
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

async function conversionWindowStats(from: Date, to: Date) {
  const where = { createdAt: { gte: from, lte: to } };
  const [count, aggregate] = await Promise.all([
    prisma.cpaOfferConversion.count({ where }),
    prisma.cpaOfferConversion.aggregate({
      where,
      _sum: { payout: true },
    }),
  ]);
  return {
    count,
    payout: Number(aggregate._sum.payout ?? 0),
  };
}

async function conversionStatusCounts(params: {
  from: Date;
  to: Date;
  advertiserId?: string;
}): Promise<{
  total: number;
  approved: number;
  pending: number;
  rejected: number;
}> {
  const { from, to, advertiserId } = params;

  const conversionWhere: Prisma.CpaOfferConversionWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(advertiserId ? { advertiserId } : {}),
  };

  const total = await prisma.cpaOfferConversion.count({ where: conversionWhere });

  const [pendingRows, rejectedRows] = await Promise.all([
    prisma.cpaPostbackDelivery.groupBy({
      by: ["conversionId"],
      where: {
        target: "ADVERTISER_GLOBAL",
        status: "PENDING",
        conversion: conversionWhere,
      },
      _count: { _all: true },
    }),
    prisma.cpaPostbackDelivery.groupBy({
      by: ["conversionId"],
      where: {
        target: "ADVERTISER_GLOBAL",
        status: { in: ["FAILED", "SKIPPED"] },
        conversion: conversionWhere,
      },
      _count: { _all: true },
    }),
  ]);

  const pendingIds = new Set(pendingRows.map((r) => r.conversionId));
  const rejectedCount = rejectedRows.filter((r) => !pendingIds.has(r.conversionId)).length;

  const pending = pendingIds.size;
  const rejected = rejectedCount;
  const approved = Math.max(0, total - pending - rejected);

  return { total, approved, pending, rejected };
}

async function clickWindowStats(params: {
  from: Date;
  to: Date;
  advertiserId?: string;
}): Promise<{ hits: number; clicks: number }> {
  const { from, to, advertiserId } = params;

  const where: Prisma.CpaOfferClickWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(advertiserId ? { advertiserId } : {}),
  };

  const [hits, ipGroups] = await Promise.all([
    prisma.cpaOfferClick.count({ where }),
    prisma.cpaOfferClick.groupBy({
      by: ["ip"],
      where: { ...where, ip: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const uniqueIpCount = ipGroups.length;
  const clicks = uniqueIpCount > 0 ? uniqueIpCount : hits;
  return { hits, clicks };
}

async function revenuePayoutProfitTotals(params: {
  from: Date;
  to: Date;
  advertiserId?: string;
}): Promise<{ revenue: number; payout: number; profit: number }> {
  const { from, to, advertiserId } = params;

  const conversionWhere: Prisma.CpaOfferConversionWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(advertiserId ? { advertiserId } : {}),
  };

  const [totalPerOffer, nonNullPayoutPerOffer] = await Promise.all([
    prisma.cpaOfferConversion.groupBy({
      by: ["offerId"],
      where: conversionWhere,
      _count: { id: true },
    }),
    prisma.cpaOfferConversion.groupBy({
      by: ["offerId"],
      where: { ...conversionWhere, payout: { not: null } },
      _count: { id: true },
      _sum: { payout: true },
    }),
  ]);

  const offerIds = Array.from(new Set(totalPerOffer.map((r) => r.offerId)));
  if (offerIds.length === 0) return { revenue: 0, payout: 0, profit: 0 };

  const offers = await prisma.cpaOffer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, revenue: true, payout: true },
  });

  const nonNullByOffer = new Map(
    nonNullPayoutPerOffer.map((r) => [
      r.offerId,
      {
        nonNullCount: r._count.id,
        payoutSum: Number(r._sum.payout ?? 0),
      },
    ]),
  );

  let revenue = 0;
  let payout = 0;

  for (const offerRow of totalPerOffer) {
    const offer = offers.find((o) => o.id === offerRow.offerId);
    if (!offer) continue;

    const totalCount = offerRow._count.id;
    const nonNull = nonNullByOffer.get(offerRow.offerId);
    const nonNullCount = nonNull?.nonNullCount ?? 0;
    const nonNullPayoutSum = nonNull?.payoutSum ?? 0;
    const nullPayoutCount = Math.max(0, totalCount - nonNullCount);

    revenue += totalCount * Number(offer.revenue ?? 0);
    payout += nonNullPayoutSum + nullPayoutCount * Number(offer.payout ?? 0);
  }

  return {
    revenue: round2(revenue),
    payout: round2(payout),
    profit: round2(revenue - payout),
  };
}

async function computeDashboardTotals(params: {
  from: Date;
  to: Date;
  advertiserId?: string;
}): Promise<{
  hits: number;
  clicks: number;
  conversionsApproved: number;
  conversionsPending: number;
  conversionsRejected: number;
  revenue: number;
  payout: number;
  profit: number;
}> {
  const [clicks, status, money] = await Promise.all([
    clickWindowStats(params),
    conversionStatusCounts(params),
    revenuePayoutProfitTotals(params),
  ]);

  return {
    hits: clicks.hits,
    clicks: clicks.clicks,
    conversionsApproved: status.approved,
    conversionsPending: status.pending,
    conversionsRejected: status.rejected,
    revenue: money.revenue,
    payout: money.payout,
    profit: money.profit,
  };
}

async function buildDashboardSeries(params: {
  from: Date;
  to: Date;
  advertiserId?: string;
}): Promise<CpaDashboardSnapshot["series"]> {
  const { from, to, advertiserId } = params;

  const days = eachUtcDay(from, to);
  const clickWhere: Prisma.CpaOfferClickWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(advertiserId ? { advertiserId } : {}),
  };
  const conversionWhere: Prisma.CpaOfferConversionWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(advertiserId ? { advertiserId } : {}),
  };

  const [clickRows, conversionRows] = await Promise.all([
    prisma.cpaOfferClick.findMany({
      where: clickWhere,
      select: { createdAt: true, ip: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: conversionWhere,
      select: { createdAt: true },
    }),
  ]);

  const clickCountByDay = new Map<string, number>();
  const uniqueIpByDay = new Map<string, Set<string>>();
  for (const row of clickRows) {
    const key = startOfUtcDay(row.createdAt).toISOString().slice(0, 10);
    clickCountByDay.set(key, (clickCountByDay.get(key) ?? 0) + 1);
    if (row.ip) {
      const set = uniqueIpByDay.get(key) ?? new Set<string>();
      set.add(row.ip);
      uniqueIpByDay.set(key, set);
    }
  }

  const conversionCountByDay = new Map<string, number>();
  for (const row of conversionRows) {
    const key = startOfUtcDay(row.createdAt).toISOString().slice(0, 10);
    conversionCountByDay.set(key, (conversionCountByDay.get(key) ?? 0) + 1);
  }

  return days.map((day) => {
    const key = day.toISOString().slice(0, 10);
    const clicks = clickCountByDay.get(key) ?? 0;
    const uniqueIpCount = uniqueIpByDay.get(key)?.size ?? 0;
    const uniqueClicks = uniqueIpCount > 0 ? uniqueIpCount : clicks;

    return {
      date: key,
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(day),
      clicks,
      uniqueClicks,
      conversions: conversionCountByDay.get(key) ?? 0,
    };
  });
}

function eachUtcDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cursor = startOfUtcDay(from);
  const last = startOfUtcDay(to);
  while (cursor.getTime() <= last.getTime()) {
    days.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return days;
}

export async function getCpaDashboardSnapshot(
  range: CpaDashboardRange = "last7d",
): Promise<CpaDashboardSnapshot> {
  const resolved = resolveDashboardRange(range);
  const { from, to, prevFrom, prevTo, label } = resolved;

  const [current, previous, series, newOfferRows] = await Promise.all([
    computeDashboardTotals({ from, to }),
    computeDashboardTotals({ from: prevFrom, to: prevTo }),
    buildDashboardSeries({ from, to }),
    prisma.cpaOffer.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        thumbnailUrl: true,
        payoutModel: true,
        category: true,
        payout: true,
      },
    }),
  ]);

  return {
    range,
    rangeLabel: label,
    from: from.toISOString(),
    to: to.toISOString(),
    metrics: {
      hits: current.hits,
      clicks: current.clicks,
      hitsClicksChangePct: pctChange(current.clicks, previous.clicks),
      conversionsApproved: current.conversionsApproved,
      conversionsPending: current.conversionsPending,
      conversionsRejected: current.conversionsRejected,
      conversionsChangePct: pctChange(
        current.conversionsApproved,
        previous.conversionsApproved,
      ),
      revenue: moneyToString(current.revenue),
      payout: moneyToString(current.payout),
      profit: moneyToString(current.profit),
      revenueChangePct: pctChange(current.revenue, previous.revenue),
      payoutChangePct: pctChange(current.payout, previous.payout),
      profitChangePct: pctChange(current.profit, previous.profit),
    },
    series,
    newOffers: newOfferRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      thumbnailUrl: row.thumbnailUrl,
      payoutModel: row.payoutModel,
      category: row.category,
      payout: decimalToString(row.payout),
    })),
  };
}

export async function getAdvertiserCpaDashboardSnapshot(
  advertiserId: string,
  range: CpaDashboardRange = "last7d",
): Promise<AdvertiserCpaDashboardSnapshot> {
  const resolved = resolveDashboardRange(range);
  const { from, to, prevFrom, prevTo, label } = resolved;

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);
  const yesterdayStart = addUtcDays(todayStart, -1);
  const yesterdayEnd = endOfUtcDay(yesterdayStart);
  const last7From = addUtcDays(todayStart, -6);
  const last30From = addUtcDays(todayStart, -29);
  const dailyFrom = last7From;
  const dailyTo = todayEnd;

  const [
    current,
    previous,
    series,
    newOfferRows,
    todayMoney,
    yesterdayMoney,
    last7Money,
    last30Money,
    dailyClickRows,
    dailyConversionRows,
  ] = await Promise.all([
    computeDashboardTotals({ from, to, advertiserId }),
    computeDashboardTotals({ from: prevFrom, to: prevTo, advertiserId }),
    buildDashboardSeries({ from, to, advertiserId }),
    prisma.cpaOffer.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        thumbnailUrl: true,
        payoutModel: true,
        category: true,
        payout: true,
      },
    }),
    revenuePayoutProfitTotals({ from: todayStart, to: todayEnd, advertiserId }),
    revenuePayoutProfitTotals({
      from: yesterdayStart,
      to: yesterdayEnd,
      advertiserId,
    }),
    revenuePayoutProfitTotals({ from: last7From, to: todayEnd, advertiserId }),
    revenuePayoutProfitTotals({ from: last30From, to: todayEnd, advertiserId }),
    prisma.cpaOfferClick.findMany({
      where: {
        advertiserId,
        createdAt: { gte: dailyFrom, lte: dailyTo },
      },
      select: { createdAt: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: {
        advertiserId,
        createdAt: { gte: dailyFrom, lte: dailyTo },
      },
      select: {
        createdAt: true,
        payout: true,
        offer: { select: { payout: true } },
      },
    }),
  ]);

  const hopsByDay = new Map<string, number>();
  for (const row of dailyClickRows) {
    const key = startOfUtcDay(row.createdAt).toISOString().slice(0, 10);
    hopsByDay.set(key, (hopsByDay.get(key) ?? 0) + 1);
  }

  const salesByDay = new Map<string, number>();
  const earningsByDay = new Map<string, number>();
  for (const row of dailyConversionRows) {
    const key = startOfUtcDay(row.createdAt).toISOString().slice(0, 10);
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + 1);
    const payout =
      row.payout != null ? Number(row.payout) : Number(row.offer.payout ?? 0);
    earningsByDay.set(key, (earningsByDay.get(key) ?? 0) + payout);
  }

  // Newest day first (Warrior+Plus style).
  const dailyStats: CpaDailyStatRow[] = eachUtcDay(dailyFrom, dailyTo)
    .map((day) => {
      const key = day.toISOString().slice(0, 10);
      return {
        date: key,
        hops: hopsByDay.get(key) ?? 0,
        sales: salesByDay.get(key) ?? 0,
        earnings: moneyToString(earningsByDay.get(key) ?? 0),
        other: "0.00",
      };
    })
    .reverse();

  return {
    range,
    rangeLabel: label,
    from: from.toISOString(),
    to: to.toISOString(),
    metrics: {
      hits: current.hits,
      clicks: current.clicks,
      hitsClicksChangePct: pctChange(current.clicks, previous.clicks),
      conversionsApproved: current.conversionsApproved,
      conversionsPending: current.conversionsPending,
      conversionsRejected: current.conversionsRejected,
      conversionsChangePct: pctChange(
        current.conversionsApproved,
        previous.conversionsApproved,
      ),
      revenue: moneyToString(current.revenue),
      payout: moneyToString(current.payout),
      profit: moneyToString(current.profit),
      revenueChangePct: pctChange(current.revenue, previous.revenue),
      payoutChangePct: pctChange(current.payout, previous.payout),
      profitChangePct: pctChange(current.profit, previous.profit),
    },
    series,
    newOffers: newOfferRows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      thumbnailUrl: row.thumbnailUrl,
      payoutModel: row.payoutModel,
      category: row.category,
      payout: decimalToString(row.payout),
    })),
    earningsByPeriod: {
      today: moneyToString(todayMoney.payout),
      yesterday: moneyToString(yesterdayMoney.payout),
      last7d: moneyToString(last7Money.payout),
      last30d: moneyToString(last30Money.payout),
    },
    dailyStats,
  };
}

export type CpaConversionsReportStats = {
  hits: number;
  clicks: number;
  conversionsApproved: number;
  conversionsPending: number;
  conversionsRejected: number;
  revenue: string;
  payout: string;
  profit: string;
};

async function clickWindowStatsFromWhere(
  where: Prisma.CpaOfferClickWhereInput,
): Promise<{ hits: number; clicks: number }> {
  const [hits, ipGroups] = await Promise.all([
    prisma.cpaOfferClick.count({ where }),
    prisma.cpaOfferClick.groupBy({
      by: ["ip"],
      where: { ...where, ip: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const uniqueIpCount = ipGroups.length;
  const clicks = uniqueIpCount > 0 ? uniqueIpCount : hits;
  return { hits, clicks };
}

async function conversionStatusCountsFromWhere(
  where: Prisma.CpaOfferConversionWhereInput,
): Promise<{ total: number; approved: number; pending: number; rejected: number }> {
  const total = await prisma.cpaOfferConversion.count({ where });

  const [pendingRows, rejectedRows] = await Promise.all([
    prisma.cpaPostbackDelivery.groupBy({
      by: ["conversionId"],
      where: {
        target: "ADVERTISER_GLOBAL",
        status: "PENDING",
        conversion: where,
      },
      _count: { _all: true },
    }),
    prisma.cpaPostbackDelivery.groupBy({
      by: ["conversionId"],
      where: {
        target: "ADVERTISER_GLOBAL",
        status: { in: ["FAILED", "SKIPPED"] },
        conversion: where,
      },
      _count: { _all: true },
    }),
  ]);

  const pendingIds = new Set(pendingRows.map((r) => r.conversionId));
  const pending = pendingIds.size;
  const rejected = rejectedRows.filter((r) => !pendingIds.has(r.conversionId)).length;
  const approved = Math.max(0, total - pending - rejected);

  return { total, approved, pending, rejected };
}

async function revenuePayoutProfitTotalsFromWhere(
  where: Prisma.CpaOfferConversionWhereInput,
): Promise<{ revenue: number; payout: number; profit: number }> {
  const [totalPerOffer, nonNullPayoutPerOffer] = await Promise.all([
    prisma.cpaOfferConversion.groupBy({
      by: ["offerId"],
      where,
      _count: { id: true },
    }),
    prisma.cpaOfferConversion.groupBy({
      by: ["offerId"],
      where: { ...where, payout: { not: null } },
      _count: { id: true },
      _sum: { payout: true },
    }),
  ]);

  const offerIds = Array.from(new Set(totalPerOffer.map((r) => r.offerId)));
  if (offerIds.length === 0) return { revenue: 0, payout: 0, profit: 0 };

  const offers = await prisma.cpaOffer.findMany({
    where: { id: { in: offerIds } },
    select: { id: true, revenue: true, payout: true },
  });

  const nonNullByOffer = new Map(
    nonNullPayoutPerOffer.map((r) => [
      r.offerId,
      {
        nonNullCount: r._count.id,
        payoutSum: Number(r._sum.payout ?? 0),
      },
    ]),
  );

  let revenue = 0;
  let payout = 0;

  for (const offerRow of totalPerOffer) {
    const offer = offers.find((o) => o.id === offerRow.offerId);
    if (!offer) continue;

    const totalCount = offerRow._count.id;
    const nonNull = nonNullByOffer.get(offerRow.offerId);
    const nonNullCount = nonNull?.nonNullCount ?? 0;
    const nonNullPayoutSum = nonNull?.payoutSum ?? 0;
    const nullPayoutCount = Math.max(0, totalCount - nonNullCount);

    revenue += totalCount * Number(offer.revenue ?? 0);
    payout += nonNullPayoutSum + nullPayoutCount * Number(offer.payout ?? 0);
  }

  return {
    revenue: round2(revenue),
    payout: round2(payout),
    profit: round2(revenue - payout),
  };
}

export type SerializedCpaConversion = {
  id: string;
  offerId: string;
  offerName: string;
  offerStatus: CpaOfferStatus;
  advertiserId: string | null;
  advertiserName: string | null;
  publisherId: string | null;
  publisherName: string | null;
  clickId: string | null;
  payout: string;
  revenue: string;
  status: "A" | "P" | "R";
  rawQuery: unknown;
  ip: string | null;
  device: string;
  browser: string;
  source: string | null;
  subId: string | null;
  createdAt: string;
};

export type CpaConversionListResult = {
  items: SerializedCpaConversion[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: CpaConversionsReportStats;
};

export type CpaConversionListFilters = {
  q?: string;
  offerId?: string;
  advertiserId?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

function serializeCpaConversionRow(
  row: {
    id: string;
    offerId: string;
    advertiserId: string | null;
    clickId: string | null;
    payout: { toString(): string } | null;
    rawQuery: unknown;
    createdAt: Date;
    offer: {
      name: string;
      status: CpaOfferStatus;
      revenue: { toString(): string } | null;
      payout: { toString(): string };
    };
    advertiser: { name: string } | null;
    clickRecord: {
      ip: string | null;
      userAgent: string | null;
      src: string | null;
      subId: string | null;
      publisherId?: string | null;
      publisher?: { name: string } | null;
    } | null;
  },
  status: "A" | "P" | "R",
): SerializedCpaConversion {
  const click = row.clickRecord;
  const { device, browser } = parseUserAgent(click?.userAgent);
  return {
    id: row.id,
    offerId: row.offerId,
    offerName: row.offer.name,
    offerStatus: row.offer.status,
    advertiserId: row.advertiserId,
    advertiserName: row.advertiser?.name ?? null,
    publisherId: click?.publisherId ?? null,
    publisherName: click?.publisher?.name ?? null,
    clickId: row.clickId,
    payout: row.payout != null ? decimalToString(row.payout) : decimalToString(row.offer.payout),
    revenue: row.offer.revenue != null ? decimalToString(row.offer.revenue) : "0",
    status,
    rawQuery: row.rawQuery,
    ip: click?.ip ?? null,
    device,
    browser,
    source: click?.src ?? null,
    subId: click?.subId ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function resolveConversionStatus(
  byConversionId: Map<string, { hasPending: boolean; hasRejected: boolean }>,
  conversionId: string,
): "A" | "P" | "R" {
  const s = byConversionId.get(conversionId);
  if (!s) return "A";
  if (s.hasPending) return "P";
  if (s.hasRejected) return "R";
  return "A";
}

export async function listCpaConversionsForAdmin(
  filters: CpaConversionListFilters,
): Promise<CpaConversionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CpaOfferConversionWhereInput = {};
  const clickWhere: Prisma.CpaOfferClickWhereInput = {};

  const offerId = filters.offerId?.trim();
  if (offerId) where.offerId = offerId;
  if (offerId) clickWhere.offerId = offerId;

  const advertiserId = filters.advertiserId?.trim();
  if (advertiserId) where.advertiserId = advertiserId;
  if (advertiserId) clickWhere.advertiserId = advertiserId;

  const publisherId = filters.publisherId?.trim();
  if (publisherId) {
    where.clickRecord = { ...(where.clickRecord as object), publisherId };
    clickWhere.publisherId = publisherId;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    clickWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
        clickWhere.createdAt.gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
        clickWhere.createdAt.lte = to;
      }
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
      { clickRecord: { publisher: { name: { contains: q } } } },
    ];

    clickWhere.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
      { publisher: { name: { contains: q } } },
    ];
  }

  const [total, rows, stats] = await Promise.all([
    prisma.cpaOfferConversion.count({ where }),
    prisma.cpaOfferConversion.findMany({
      where,
      include: {
        offer: { select: { name: true, status: true, revenue: true, payout: true } },
        advertiser: { select: { name: true } },
        clickRecord: {
          select: {
            ip: true,
            userAgent: true,
            src: true,
            subId: true,
            publisherId: true,
            publisher: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (async () => {
      const [clickStats, status, money] = await Promise.all([
        clickWindowStatsFromWhere(clickWhere),
        conversionStatusCountsFromWhere(where),
        revenuePayoutProfitTotalsFromWhere(where),
      ]);

      return {
        hits: clickStats.hits,
        clicks: clickStats.clicks,
        conversionsApproved: status.approved,
        conversionsPending: status.pending,
        conversionsRejected: status.rejected,
        revenue: moneyToString(money.revenue),
        payout: moneyToString(money.payout),
        profit: moneyToString(money.profit),
      } satisfies CpaConversionsReportStats;
    })(),
  ]);

  const conversionIds = rows.map((r) => r.id);
  const deliveries = await prisma.cpaPostbackDelivery.findMany({
    where: { conversionId: { in: conversionIds }, target: "ADVERTISER_GLOBAL" },
    select: { conversionId: true, status: true },
  });

  const byConversionId = new Map<
    string,
    { hasPending: boolean; hasRejected: boolean }
  >();
  for (const id of conversionIds) {
    byConversionId.set(id, { hasPending: false, hasRejected: false });
  }
  for (const d of deliveries) {
    const current = byConversionId.get(d.conversionId);
    if (!current) continue;
    if (d.status === "PENDING") current.hasPending = true;
    if (d.status === "FAILED" || d.status === "SKIPPED") current.hasRejected = true;
  }

  return {
    items: rows.map((row) =>
      serializeCpaConversionRow(row, resolveConversionStatus(byConversionId, row.id)),
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function listCpaConversionsForAdvertiser(
  advertiserId: string,
  filters: CpaConversionListFilters,
): Promise<CpaConversionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CpaOfferConversionWhereInput = {
    advertiserId,
  };
  const clickWhere: Prisma.CpaOfferClickWhereInput = {
    advertiserId,
  };

  const offerId = filters.offerId?.trim();
  if (offerId) where.offerId = offerId;
  if (offerId) clickWhere.offerId = offerId;

  if (filters.from || filters.to) {
    where.createdAt = {};
    clickWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
        clickWhere.createdAt.gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
        clickWhere.createdAt.lte = to;
      }
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
    ];

    clickWhere.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
    ];
  }

  const [total, rows, stats] = await Promise.all([
    prisma.cpaOfferConversion.count({ where }),
    prisma.cpaOfferConversion.findMany({
      where,
      include: {
        offer: { select: { name: true, status: true, revenue: true, payout: true } },
        advertiser: { select: { name: true } },
        clickRecord: { select: { ip: true, userAgent: true, src: true, subId: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (async () => {
      const [clickStats, status, money] = await Promise.all([
        clickWindowStatsFromWhere(clickWhere),
        conversionStatusCountsFromWhere(where),
        revenuePayoutProfitTotalsFromWhere(where),
      ]);

      return {
        hits: clickStats.hits,
        clicks: clickStats.clicks,
        conversionsApproved: status.approved,
        conversionsPending: status.pending,
        conversionsRejected: status.rejected,
        revenue: moneyToString(money.revenue),
        payout: moneyToString(money.payout),
        profit: moneyToString(money.profit),
      } satisfies CpaConversionsReportStats;
    })(),
  ]);

  const conversionIds = rows.map((r) => r.id);
  const deliveries = await prisma.cpaPostbackDelivery.findMany({
    where: { conversionId: { in: conversionIds }, target: "ADVERTISER_GLOBAL" },
    select: { conversionId: true, status: true },
  });

  const byConversionId = new Map<
    string,
    { hasPending: boolean; hasRejected: boolean }
  >();
  for (const id of conversionIds) {
    byConversionId.set(id, { hasPending: false, hasRejected: false });
  }
  for (const d of deliveries) {
    const current = byConversionId.get(d.conversionId);
    if (!current) continue;
    if (d.status === "PENDING") current.hasPending = true;
    if (d.status === "FAILED" || d.status === "SKIPPED") current.hasRejected = true;
  }

  return {
    items: rows.map((row) =>
      serializeCpaConversionRow(row, resolveConversionStatus(byConversionId, row.id)),
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function listCpaConversionsForPublisher(
  publisherId: string,
  filters: CpaConversionListFilters,
): Promise<CpaConversionListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CpaOfferConversionWhereInput = {
    clickRecord: { publisherId },
  };
  const clickWhere: Prisma.CpaOfferClickWhereInput = {
    publisherId,
  };

  const offerId = filters.offerId?.trim();
  if (offerId) where.offerId = offerId;
  if (offerId) clickWhere.offerId = offerId;

  if (filters.from || filters.to) {
    where.createdAt = {};
    clickWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
        clickWhere.createdAt.gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
        clickWhere.createdAt.lte = to;
      }
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
    ];

    clickWhere.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
    ];
  }

  const [total, rows, stats] = await Promise.all([
    prisma.cpaOfferConversion.count({ where }),
    prisma.cpaOfferConversion.findMany({
      where,
      include: {
        offer: { select: { name: true, status: true, revenue: true, payout: true } },
        advertiser: { select: { name: true } },
        clickRecord: { select: { ip: true, userAgent: true, src: true, subId: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (async () => {
      const [clickStats, status, money] = await Promise.all([
        clickWindowStatsFromWhere(clickWhere),
        conversionStatusCountsFromWhere(where),
        revenuePayoutProfitTotalsFromWhere(where),
      ]);

      return {
        hits: clickStats.hits,
        clicks: clickStats.clicks,
        conversionsApproved: status.approved,
        conversionsPending: status.pending,
        conversionsRejected: status.rejected,
        revenue: moneyToString(money.revenue),
        payout: moneyToString(money.payout),
        profit: moneyToString(money.profit),
      } satisfies CpaConversionsReportStats;
    })(),
  ]);

  const conversionIds = rows.map((r) => r.id);
  const deliveries = await prisma.cpaPostbackDelivery.findMany({
    where: { conversionId: { in: conversionIds }, target: "ADVERTISER_GLOBAL" },
    select: { conversionId: true, status: true },
  });

  const byConversionId = new Map<
    string,
    { hasPending: boolean; hasRejected: boolean }
  >();
  for (const id of conversionIds) {
    byConversionId.set(id, { hasPending: false, hasRejected: false });
  }
  for (const d of deliveries) {
    const current = byConversionId.get(d.conversionId);
    if (!current) continue;
    if (d.status === "PENDING") current.hasPending = true;
    if (d.status === "FAILED" || d.status === "SKIPPED") current.hasRejected = true;
  }

  return {
    items: rows.map((row) =>
      serializeCpaConversionRow(row, resolveConversionStatus(byConversionId, row.id)),
    ),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export type SerializedCpaClick = {
  id: string;
  offerId: string;
  offerName: string;
  offerStatus: CpaOfferStatus;
  advertiserId: string | null;
  advertiserName: string | null;
  publisherId: string | null;
  publisherName: string | null;
  ip: string | null;
  device: string;
  browser: string;
  source: string | null;
  subId: string | null;
  converted: boolean;
  createdAt: string;
};

export type CpaClickListResult = {
  items: SerializedCpaClick[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: CpaConversionsReportStats;
};

export type CpaClickListFilters = CpaConversionListFilters;

function serializeCpaClickRow(row: {
  id: string;
  offerId: string;
  advertiserId: string | null;
  publisherId: string | null;
  ip: string | null;
  userAgent: string | null;
  src: string | null;
  subId: string | null;
  createdAt: Date;
  offer: { name: string; status: CpaOfferStatus };
  advertiser: { name: string } | null;
  publisher: { name: string } | null;
  conversions: { id: string }[];
}): SerializedCpaClick {
  const { device, browser } = parseUserAgent(row.userAgent);
  return {
    id: row.id,
    offerId: row.offerId,
    offerName: row.offer.name,
    offerStatus: row.offer.status,
    advertiserId: row.advertiserId,
    advertiserName: row.advertiser?.name ?? null,
    publisherId: row.publisherId,
    publisherName: row.publisher?.name ?? null,
    ip: row.ip,
    device,
    browser,
    source: row.src,
    subId: row.subId,
    converted: row.conversions.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

async function reportStatsForClickWindow(
  clickWhere: Prisma.CpaOfferClickWhereInput,
  conversionWhere: Prisma.CpaOfferConversionWhereInput,
): Promise<CpaConversionsReportStats> {
  const [clickStats, status, money] = await Promise.all([
    clickWindowStatsFromWhere(clickWhere),
    conversionStatusCountsFromWhere(conversionWhere),
    revenuePayoutProfitTotalsFromWhere(conversionWhere),
  ]);

  return {
    hits: clickStats.hits,
    clicks: clickStats.clicks,
    conversionsApproved: status.approved,
    conversionsPending: status.pending,
    conversionsRejected: status.rejected,
    revenue: moneyToString(money.revenue),
    payout: moneyToString(money.payout),
    profit: moneyToString(money.profit),
  };
}

export async function listCpaClicksForAdmin(
  filters: CpaClickListFilters,
): Promise<CpaClickListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CpaOfferClickWhereInput = {};
  const conversionWhere: Prisma.CpaOfferConversionWhereInput = {};

  const offerId = filters.offerId?.trim();
  if (offerId) {
    where.offerId = offerId;
    conversionWhere.offerId = offerId;
  }

  const advertiserId = filters.advertiserId?.trim();
  if (advertiserId) {
    where.advertiserId = advertiserId;
    conversionWhere.advertiserId = advertiserId;
  }

  const publisherId = filters.publisherId?.trim();
  if (publisherId) {
    where.publisherId = publisherId;
    conversionWhere.clickRecord = { publisherId };
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    conversionWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
        conversionWhere.createdAt.gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
        conversionWhere.createdAt.lte = to;
      }
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
      { publisher: { name: { contains: q } } },
      { subId: { contains: q } },
      { src: { contains: q } },
      { ip: { contains: q } },
    ];

    conversionWhere.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
    ];
  }

  const [total, rows, stats] = await Promise.all([
    prisma.cpaOfferClick.count({ where }),
    prisma.cpaOfferClick.findMany({
      where,
      include: {
        offer: { select: { name: true, status: true } },
        advertiser: { select: { name: true } },
        publisher: { select: { name: true } },
        conversions: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    reportStatsForClickWindow(where, conversionWhere),
  ]);

  return {
    items: rows.map(serializeCpaClickRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function listCpaClicksForPublisher(
  publisherId: string,
  filters: CpaClickListFilters,
): Promise<CpaClickListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const where: Prisma.CpaOfferClickWhereInput = { publisherId };
  const conversionWhere: Prisma.CpaOfferConversionWhereInput = {
    clickRecord: { publisherId },
  };

  const offerId = filters.offerId?.trim();
  if (offerId) {
    where.offerId = offerId;
    conversionWhere.offerId = offerId;
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    conversionWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) {
        where.createdAt.gte = from;
        conversionWhere.createdAt.gte = from;
      }
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) {
        where.createdAt.lte = to;
        conversionWhere.createdAt.lte = to;
      }
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { subId: { contains: q } },
      { src: { contains: q } },
      { ip: { contains: q } },
    ];

    conversionWhere.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
    ];
  }

  const [total, rows, stats] = await Promise.all([
    prisma.cpaOfferClick.count({ where }),
    prisma.cpaOfferClick.findMany({
      where,
      include: {
        offer: { select: { name: true, status: true } },
        advertiser: { select: { name: true } },
        publisher: { select: { name: true } },
        conversions: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    reportStatsForClickWindow(where, conversionWhere),
  ]);

  return {
    items: rows.map(serializeCpaClickRow),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export type SerializedCpaAffiliateOfferReportRow = {
  publisherId: string;
  publisherName: string;
  offerId: string;
  offerName: string;
  offerStatus: CpaOfferStatus | null;
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: string;
  payout: string;
  revenue: string;
  profit: string;
};

export type CpaAffiliateOfferReportStats = {
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: string;
  payout: string;
  revenue: string;
  profit: string;
};

export type CpaAffiliateOfferReportResult = {
  items: SerializedCpaAffiliateOfferReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: CpaAffiliateOfferReportStats;
};

function buildAffiliateOfferClickWhere(
  filters: CpaConversionListFilters,
): Prisma.CpaOfferClickWhereInput {
  const where: Prisma.CpaOfferClickWhereInput = {
    publisherId: { not: null },
  };

  const offerId = filters.offerId?.trim();
  if (offerId) where.offerId = offerId;

  const advertiserId = filters.advertiserId?.trim();
  if (advertiserId) where.advertiserId = advertiserId;

  const publisherId = filters.publisherId?.trim();
  if (publisherId) where.publisherId = publisherId;

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) where.createdAt.lte = to;
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { id: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
      { publisher: { name: { contains: q } } },
    ];
  }

  return where;
}

function buildAffiliateOfferConversionWhere(
  filters: CpaConversionListFilters,
): Prisma.CpaOfferConversionWhereInput {
  const where: Prisma.CpaOfferConversionWhereInput = {
    clickRecord: { publisherId: { not: null } },
  };

  const offerId = filters.offerId?.trim();
  if (offerId) where.offerId = offerId;

  const advertiserId = filters.advertiserId?.trim();
  if (advertiserId) where.advertiserId = advertiserId;

  const publisherId = filters.publisherId?.trim();
  if (publisherId) {
    where.clickRecord = { publisherId };
  }

  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) where.createdAt.lte = to;
    }
  }

  const q = filters.q?.trim();
  if (q) {
    where.OR = [
      { clickId: { contains: q } },
      { offer: { name: { contains: q } } },
      { offerId: { contains: q } },
      { advertiser: { name: { contains: q } } },
      { clickRecord: { publisher: { name: { contains: q } } } },
    ];
  }

  return where;
}

export async function listCpaAffiliateOfferReportForAdmin(
  filters: CpaConversionListFilters,
): Promise<CpaAffiliateOfferReportResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const clickWhere = buildAffiliateOfferClickWhere(filters);
  const conversionWhere = buildAffiliateOfferConversionWhere(filters);

  const [clickGroups, conversionRows] = await Promise.all([
    prisma.cpaOfferClick.groupBy({
      by: ["publisherId", "offerId"],
      where: clickWhere,
      _count: { _all: true },
    }),
    prisma.cpaOfferConversion.findMany({
      where: conversionWhere,
      select: {
        id: true,
        offerId: true,
        payout: true,
        offer: { select: { name: true, status: true, revenue: true, payout: true } },
        clickRecord: { select: { publisherId: true } },
      },
    }),
  ]);

  const conversionIds = conversionRows.map((r) => r.id);
  const deliveries =
    conversionIds.length === 0
      ? []
      : await prisma.cpaPostbackDelivery.findMany({
          where: {
            conversionId: { in: conversionIds },
            target: "ADVERTISER_GLOBAL",
          },
          select: { conversionId: true, status: true },
        });

  const statusByConversionId = new Map<string, { hasPending: boolean; hasRejected: boolean }>();
  for (const d of deliveries) {
    const cur = statusByConversionId.get(d.conversionId) ?? {
      hasPending: false,
      hasRejected: false,
    };
    if (d.status === "PENDING") cur.hasPending = true;
    if (d.status === "FAILED" || d.status === "SKIPPED") cur.hasRejected = true;
    statusByConversionId.set(d.conversionId, cur);
  }

  type Acc = {
    publisherId: string;
    offerId: string;
    clicks: number;
    conversions: number;
    payout: number;
    revenue: number;
  };

  const byKey = new Map<string, Acc>();
  const keyOf = (publisherId: string, offerId: string) => `${publisherId}::${offerId}`;

  for (const g of clickGroups) {
    if (!g.publisherId) continue;
    const key = keyOf(g.publisherId, g.offerId);
    byKey.set(key, {
      publisherId: g.publisherId,
      offerId: g.offerId,
      clicks: g._count._all,
      conversions: 0,
      payout: 0,
      revenue: 0,
    });
  }

  for (const row of conversionRows) {
    const publisherId = row.clickRecord?.publisherId;
    if (!publisherId) continue;

    const statusFlags = statusByConversionId.get(row.id);
    let status: "A" | "P" | "R" = "A";
    if (statusFlags?.hasPending) status = "P";
    else if (statusFlags?.hasRejected) status = "R";
    if (status !== "A") continue;

    const key = keyOf(publisherId, row.offerId);
    const acc = byKey.get(key) ?? {
      publisherId,
      offerId: row.offerId,
      clicks: 0,
      conversions: 0,
      payout: 0,
      revenue: 0,
    };

    acc.conversions += 1;
    acc.revenue += Number(row.offer.revenue ?? 0);
    acc.payout +=
      row.payout != null ? Number(row.payout) : Number(row.offer.payout ?? 0);
    byKey.set(key, acc);
  }

  const publisherIds = Array.from(new Set([...byKey.values()].map((r) => r.publisherId)));
  const offerIds = Array.from(new Set([...byKey.values()].map((r) => r.offerId)));

  const [publishers, offers] = await Promise.all([
    publisherIds.length
      ? prisma.user.findMany({
          where: { id: { in: publisherIds } },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
    offerIds.length
      ? prisma.cpaOffer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, name: true, status: true },
        })
      : Promise.resolve([] as { id: string; name: string; status: CpaOfferStatus }[]),
  ]);

  const publisherNameById = new Map(publishers.map((p) => [p.id, p.name]));
  const offerById = new Map(offers.map((o) => [o.id, o]));

  const allRows: SerializedCpaAffiliateOfferReportRow[] = Array.from(byKey.values())
    .map((acc) => {
      const clicks = acc.clicks;
      const conversions = acc.conversions;
      const payout = round2(acc.payout);
      const revenue = round2(acc.revenue);
      const profit = round2(revenue - payout);
      const conversionRate =
        clicks > 0 ? Math.round((conversions / clicks) * 10000) / 100 : 0;
      const epc = clicks > 0 ? round2(payout / clicks) : 0;
      const offer = offerById.get(acc.offerId);

      return {
        publisherId: acc.publisherId,
        publisherName: publisherNameById.get(acc.publisherId) ?? "Unknown",
        offerId: acc.offerId,
        offerName: offer?.name ?? acc.offerId,
        offerStatus: offer?.status ?? null,
        clicks,
        conversions,
        conversionRate,
        epc: moneyToString(epc),
        payout: moneyToString(payout),
        revenue: moneyToString(revenue),
        profit: moneyToString(profit),
      };
    })
    .sort((a, b) => {
      const byPub = a.publisherName.localeCompare(b.publisherName);
      if (byPub !== 0) return byPub;
      return a.offerName.localeCompare(b.offerName);
    });

  const totals = allRows.reduce(
    (sum, row) => {
      sum.clicks += row.clicks;
      sum.conversions += row.conversions;
      sum.payout += Number(row.payout);
      sum.revenue += Number(row.revenue);
      return sum;
    },
    { clicks: 0, conversions: 0, payout: 0, revenue: 0 },
  );

  const totalPayout = round2(totals.payout);
  const totalRevenue = round2(totals.revenue);
  const totalProfit = round2(totalRevenue - totalPayout);
  const totalCr =
    totals.clicks > 0
      ? Math.round((totals.conversions / totals.clicks) * 10000) / 100
      : 0;
  const totalEpc = totals.clicks > 0 ? round2(totalPayout / totals.clicks) : 0;

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = allRows.slice((page - 1) * limit, page * limit);

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    stats: {
      clicks: totals.clicks,
      conversions: totals.conversions,
      conversionRate: totalCr,
      epc: moneyToString(totalEpc),
      payout: moneyToString(totalPayout),
      revenue: moneyToString(totalRevenue),
      profit: moneyToString(totalProfit),
    },
  };
}
