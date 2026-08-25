import { prisma } from "@cpl/database";
import type {
  CatalogCategoryStatus,
  DigitalProductStatus,
  Prisma,
} from "@prisma/client";
import { Errors, AppError } from "@/lib/errors";
import {
  extractLeadFromClickFunnelsPayload,
  extractOrderFieldsFromClickFunnelsPayload,
} from "@/lib/clickfunnels-webhook-payload";

export type DigitalProductListFilters = {
  q?: string;
  status?: string;
  category?: string;
  type?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
};

export type SerializedDigitalProduct = {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  niche: string;
  productType: string;
  status: "Active" | "Draft";
  price: number;
  frontEndCommission: number;
  upsellCommission: number | null;
  referralReward: number | null;
  featured: boolean;
  isNew: boolean;
  thumbTone: string | null;
  vendor: string | null;
  imageUrl: string | null;
  shortDescription: string;
  salesPageUrl: string | null;
  affiliateTrackingParam: string | null;
  previewUrl: string | null;
  webhookSecret: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedProductCategory = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  productCount: number;
};

/** Publisher marketplace view — no secrets or draft-only admin fields. */
export type SerializedPublisherDigitalProduct = {
  id: string;
  name: string;
  category: string;
  niche: string;
  productType: string;
  price: number;
  frontEndCommission: number;
  upsellCommission: number | null;
  featured: boolean;
  isNew: boolean;
  thumbTone: string | null;
  vendor: string | null;
  imageUrl: string | null;
  shortDescription: string;
  salesPageUrl: string | null;
  affiliateTrackingParam: string | null;
  previewUrl: string | null;
};

function mapProductStatus(status: DigitalProductStatus): "Active" | "Draft" {
  return status === "ACTIVE" ? "Active" : "Draft";
}

function mapCategoryStatus(status: CatalogCategoryStatus): "Active" | "Inactive" {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

function toInputStatus(status: string): DigitalProductStatus {
  return status.toLowerCase() === "draft" ? "DRAFT" : "ACTIVE";
}

function serializeProduct(row: {
  id: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  productType: string;
  niche: string;
  status: DigitalProductStatus;
  featured: boolean;
  isNew: boolean;
  salesPageUrl: string | null;
  affiliateTrackingParam: string | null;
  previewUrl: string | null;
  frontEndCommission: Prisma.Decimal;
  upsellCommission: Prisma.Decimal | null;
  referralReward: Prisma.Decimal | null;
  price: Prisma.Decimal;
  vendor: string | null;
  webhookSecret: string | null;
  imageUrl: string | null;
  thumbTone: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string };
}): SerializedDigitalProduct {
  return {
    id: row.id,
    name: row.name,
    category: row.category.name,
    categoryId: row.categoryId,
    niche: row.niche,
    productType: row.productType,
    status: mapProductStatus(row.status),
    price: Number(row.price),
    frontEndCommission: Number(row.frontEndCommission),
    upsellCommission: row.upsellCommission ? Number(row.upsellCommission) : null,
    referralReward: row.referralReward ? Number(row.referralReward) : null,
    featured: row.featured,
    isNew: row.isNew,
    thumbTone: row.thumbTone,
    vendor: row.vendor,
    imageUrl: row.imageUrl,
    shortDescription: row.shortDescription,
    salesPageUrl: row.salesPageUrl,
    affiliateTrackingParam: row.affiliateTrackingParam,
    previewUrl: row.previewUrl,
    webhookSecret: row.webhookSecret,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ProductRow = Parameters<typeof serializeProduct>[0];

function serializePublisherProduct(row: ProductRow): SerializedPublisherDigitalProduct {
  const full = serializeProduct(row);
  return {
    id: full.id,
    name: full.name,
    category: full.category,
    niche: full.niche,
    productType: full.productType,
    price: full.price,
    frontEndCommission: full.frontEndCommission,
    upsellCommission: full.upsellCommission,
    featured: full.featured,
    isNew: full.isNew,
    thumbTone: full.thumbTone,
    vendor: full.vendor,
    imageUrl: full.imageUrl,
    shortDescription: full.shortDescription,
    salesPageUrl: full.salesPageUrl,
    affiliateTrackingParam: full.affiliateTrackingParam,
    previewUrl: full.previewUrl,
  };
}

function buildProductWhere(filters: DigitalProductListFilters): Prisma.DigitalProductWhereInput {
  const where: Prisma.DigitalProductWhereInput = {};
  if (filters.activeOnly) where.status = "ACTIVE";
  else if (filters.status) {
    where.status = filters.status.toLowerCase() === "draft" ? "DRAFT" : "ACTIVE";
  }
  if (filters.category) {
    where.category = { name: filters.category };
  }
  if (filters.type) where.productType = filters.type;
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q } },
      { niche: { contains: q } },
      { vendor: { contains: q } },
      { category: { name: { contains: q } } },
    ];
  }
  return where;
}

export async function listDigitalProducts(filters: DigitalProductListFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 100;
  const where = buildProductWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.digitalProduct.findMany({
      where,
      include: { category: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.digitalProduct.count({ where }),
  ]);
  return {
    items: rows.map(serializeProduct),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function listPublisherDigitalProducts(filters: DigitalProductListFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 100;
  const where = buildProductWhere({ ...filters, activeOnly: true });
  const [rows, total] = await Promise.all([
    prisma.digitalProduct.findMany({
      where,
      include: { category: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.digitalProduct.count({ where }),
  ]);
  return {
    items: rows.map(serializePublisherProduct),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getPublisherDigitalProduct(id: string) {
  const row = await prisma.digitalProduct.findFirst({
    where: { id, status: "ACTIVE" },
    include: { category: true },
  });
  if (!row) return null;
  return serializePublisherProduct(row);
}

export async function getDigitalProductById(id: string) {
  const row = await prisma.digitalProduct.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!row) throw Errors.notFound("Digital product");
  return serializeProduct(row);
}

export async function createDigitalProduct(input: {
  name: string;
  category: string;
  shortDescription: string;
  productType: string;
  niche: string;
  status: string;
  featured?: boolean;
  isNew?: boolean;
  salesPageUrl?: string;
  affiliateTrackingParam?: string;
  previewUrl?: string;
  frontEndCommission: number;
  upsellCommission?: number;
  referralReward?: number;
  price: number;
  vendor?: string;
  webhookSecret?: string;
  imageUrl?: string;
  thumbTone?: string;
}) {
  const category = await prisma.digitalProductCategory.upsert({
    where: { name: input.category },
    create: { name: input.category, status: "ACTIVE" },
    update: {},
  });
  const row = await prisma.digitalProduct.create({
    data: {
      name: input.name,
      categoryId: category.id,
      shortDescription: input.shortDescription,
      productType: input.productType,
      niche: input.niche,
      status: toInputStatus(input.status),
      featured: input.featured ?? false,
      isNew: input.isNew ?? false,
      salesPageUrl: input.salesPageUrl,
      affiliateTrackingParam: input.affiliateTrackingParam,
      previewUrl: input.previewUrl,
      frontEndCommission: input.frontEndCommission,
      upsellCommission: input.upsellCommission,
      referralReward: input.referralReward,
      price: input.price,
      vendor: input.vendor,
      webhookSecret: input.webhookSecret,
      imageUrl: input.imageUrl,
      thumbTone: input.thumbTone,
    },
    include: { category: true },
  });
  return serializeProduct(row);
}

export async function updateDigitalProduct(
  id: string,
  input: Partial<{
    name: string;
    category: string;
    shortDescription: string;
    productType: string;
    niche: string;
    status: string;
    featured: boolean;
    isNew: boolean;
    salesPageUrl: string;
    affiliateTrackingParam: string;
    previewUrl: string;
    frontEndCommission: number;
    upsellCommission: number;
    referralReward: number;
    price: number;
    vendor: string;
    webhookSecret: string;
    imageUrl: string;
    thumbTone: string;
  }>,
) {
  const existing = await prisma.digitalProduct.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Digital product");

  let categoryId = existing.categoryId;
  if (input.category) {
    const category = await prisma.digitalProductCategory.upsert({
      where: { name: input.category },
      create: { name: input.category, status: "ACTIVE" },
      update: {},
    });
    categoryId = category.id;
  }

  const row = await prisma.digitalProduct.update({
    where: { id },
    data: {
      name: input.name,
      categoryId,
      shortDescription: input.shortDescription,
      productType: input.productType,
      niche: input.niche,
      status: input.status ? toInputStatus(input.status) : undefined,
      featured: input.featured,
      isNew: input.isNew,
      salesPageUrl: input.salesPageUrl,
      affiliateTrackingParam: input.affiliateTrackingParam,
      previewUrl: input.previewUrl,
      frontEndCommission: input.frontEndCommission,
      upsellCommission: input.upsellCommission,
      referralReward: input.referralReward,
      price: input.price,
      vendor: input.vendor,
      webhookSecret: input.webhookSecret,
      imageUrl: input.imageUrl,
      thumbTone: input.thumbTone,
    },
    include: { category: true },
  });
  return serializeProduct(row);
}

export async function deleteDigitalProduct(id: string) {
  await prisma.digitalProduct.delete({ where: { id } });
  return { id };
}

export async function listDigitalProductCategories() {
  const rows = await prisma.digitalProductCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    productCount: row._count.products,
  })) satisfies SerializedProductCategory[];
}

export async function saveDigitalProductCategory(input: {
  id?: string;
  name: string;
  status: "Active" | "Inactive";
}) {
  const status: CatalogCategoryStatus = input.status === "Active" ? "ACTIVE" : "INACTIVE";
  if (input.id) {
    const row = await prisma.digitalProductCategory.update({
      where: { id: input.id },
      data: { name: input.name, status },
      include: { _count: { select: { products: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      status: mapCategoryStatus(row.status),
      productCount: row._count.products,
    };
  }
  const row = await prisma.digitalProductCategory.create({
    data: { name: input.name, status },
    include: { _count: { select: { products: true } } },
  });
  return {
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    productCount: row._count.products,
  };
}

export async function deleteDigitalProductCategory(id: string) {
  const count = await prisma.digitalProduct.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError("VALIDATION_ERROR", "Category has products and cannot be deleted", 422);
  await prisma.digitalProductCategory.delete({ where: { id } });
  return { id };
}

// ─── Orders / Webhook Report ────────────────────────────────────────────────

export type DigitalProductOrderRow = {
  id: string;
  orderId: string | null;
  date: string;
  customerEmail: string | null;
  customerName: string | null;
  product: string | null;
  funnel: string | null;
  orderType: string | null;
  amount: number | null;
  commission: number | null;
  affiliateName: string | null;
  affiliateEmail: string | null;
  affiliateRef: string | null;
  source: string | null;
  subId: string | null;
  eventType: string;
  webhookStatus: string;
  paymentStatus: string | null;
};

export type DigitalProductOrderSummary = {
  totalOrders: number;
  grossRevenue: number;
  affiliateSales: number;
  totalCommissions: number;
  netRevenue: number;
  refunds: number;
};

function extractOrderFields(payload: unknown): {
  orderId: string | null;
  product: string | null;
  funnel: string | null;
  orderType: string | null;
  amount: number | null;
  source: string | null;
  subId: string | null;
  paymentStatus: string | null;
} {
  return extractOrderFieldsFromClickFunnelsPayload(payload);
}

function normalizeOrderType(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("upsell") || lower === "upsell") return "Upsell";
  if (lower.includes("downsell") || lower === "downsell") return "Downsell";
  if (lower.includes("front") || lower === "front_end" || lower === "order") return "Front End";
  return raw;
}

export async function listDigitalProductOrders(opts: {
  from?: Date;
  to?: Date;
  publisherId?: string;
  eventType?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 15));
  const skip = (page - 1) * limit;

  const where: Prisma.WebhookEventWhereInput = {};
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.publisherId) where.publisherId = opts.publisherId;
  if (opts.eventType) where.eventType = { contains: opts.eventType };

  const [rows, total, allForSummary] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        eventType: true,
        status: true,
        leadEmail: true,
        leadName: true,
        affiliateRef: true,
        publisherId: true,
        publisher: { select: { id: true, name: true, email: true } },
        payloadJson: true,
        createdAt: true,
      },
    }),
    prisma.webhookEvent.count({ where }),
    // For summary: fetch amounts from all matching PROCESSED rows (cap at 5000 for perf)
    prisma.webhookEvent.findMany({
      where: { ...where, status: "PROCESSED" },
      select: { publisherId: true, eventType: true, payloadJson: true },
      take: 5000,
    }),
  ]);

  // Compute summary from allForSummary
  let grossRevenue = 0;
  let affiliateSales = 0;
  let totalCommissions = 0;
  let refunds = 0;

  for (const ev of allForSummary) {
    const fields = extractOrderFields(ev.payloadJson);
    const amount = fields.amount ?? 0;
    const type = (fields.orderType ?? ev.eventType ?? "").toLowerCase();
    if (type.includes("refund")) {
      refunds += amount;
    } else {
      grossRevenue += amount;
    }
    if (ev.publisherId) {
      affiliateSales += 1;
      totalCommissions += amount * 0.5; // default 50% commission shown in report
    }
  }
  const netRevenue = grossRevenue - totalCommissions - refunds;
  const summary: DigitalProductOrderSummary = {
    totalOrders: allForSummary.length,
    grossRevenue,
    affiliateSales,
    totalCommissions,
    netRevenue,
    refunds,
  };

  const items: DigitalProductOrderRow[] = rows.map((row) => {
    const fields = extractOrderFields(row.payloadJson);
    const leadFallback = extractLeadFromClickFunnelsPayload(row.payloadJson);
    const amount = fields.amount;
    const commission = amount != null && row.publisherId ? amount * 0.5 : null;
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      customerEmail: row.leadEmail ?? leadFallback.leadEmail,
      customerName: row.leadName ?? leadFallback.leadName,
      product: fields.product,
      funnel: fields.funnel,
      orderType: normalizeOrderType(fields.orderType ?? row.eventType),
      amount,
      commission,
      affiliateName: row.publisher?.name ?? null,
      affiliateEmail: row.publisher?.email ?? null,
      affiliateRef: row.affiliateRef,
      source: fields.source,
      subId: fields.subId,
      eventType: row.eventType,
      webhookStatus: row.status,
      paymentStatus: fields.paymentStatus,
    };
  });

  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)), summary };
}

const PUBLISHER_COMMISSION_RATE = 0.5;

export type PublisherCommissionType = "Front End" | "Upsell" | "Downsell" | "Refund";

export type PublisherCommissionRow = {
  id: string;
  orderId: string;
  date: string;
  product: string | null;
  funnel: string | null;
  orderType: PublisherCommissionType;
  amount: number | null;
  commission: number | null;
  rate: number;
  source: string | null;
  subId: string | null;
  webhookStatus: string;
  paymentStatus: string | null;
};

export type PublisherCommissionKpis = {
  orders: number;
  sales: number;
  commission: number;
  refunds: number;
  frontEndCount: number;
  upsellCount: number;
};

export type PublisherCommissionChartPoint = {
  date: string;
  label: string;
  sales: number;
  commission: number;
};

export type PublisherCommissionSlice = {
  name: string;
  value: number;
};

function classifyCommissionType(raw: string | null, eventType: string): PublisherCommissionType {
  const lower = `${raw ?? ""} ${eventType}`.toLowerCase();
  if (lower.includes("refund")) return "Refund";
  if (lower.includes("upsell")) return "Upsell";
  if (lower.includes("downsell")) return "Downsell";
  return "Front End";
}

function dayKey(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesStatusFilter(
  row: { orderType: PublisherCommissionType; webhookStatus: string; paymentStatus: string | null },
  status?: string,
) {
  if (!status || status === "all") return true;
  const webhook = row.webhookStatus.toUpperCase();
  const payment = (row.paymentStatus ?? "").toLowerCase();
  if (status === "approved") return webhook === "PROCESSED" && row.orderType !== "Refund";
  if (status === "pending") return webhook === "DUPLICATE" || webhook === "IGNORED";
  if (status === "failed") return webhook === "FAILED";
  if (status === "refunded") return row.orderType === "Refund" || payment.includes("refund");
  return true;
}

export async function getPublisherCommissionReport(opts: {
  publisherId: string;
  from?: Date;
  to?: Date;
  product?: string;
  orderType?: string;
  source?: string;
  subId?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 10));

  const where: Prisma.WebhookEventWhereInput = { publisherId: opts.publisherId };
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }

  const events = await prisma.webhookEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      id: true,
      eventType: true,
      status: true,
      payloadJson: true,
      createdAt: true,
    },
  });

  const mapped: PublisherCommissionRow[] = events.map((row) => {
    const fields = extractOrderFields(row.payloadJson);
    const orderType = classifyCommissionType(fields.orderType ?? row.eventType, row.eventType);
    const amount = fields.amount;
    const isRefund = orderType === "Refund";
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      product: fields.product,
      funnel: fields.funnel,
      orderType,
      amount,
      commission: amount != null && !isRefund ? amount * PUBLISHER_COMMISSION_RATE : isRefund ? 0 : null,
      rate: PUBLISHER_COMMISSION_RATE,
      source: fields.source,
      subId: fields.subId,
      webhookStatus: row.status,
      paymentStatus: fields.paymentStatus,
    };
  });

  const products = [...new Set(mapped.map((r) => r.product).filter((v): v is string => Boolean(v)))].sort();
  const sources = [...new Set(mapped.map((r) => r.source).filter((v): v is string => Boolean(v)))].sort();
  const subIds = [...new Set(mapped.map((r) => r.subId).filter((v): v is string => Boolean(v)))].sort();

  const q = opts.q?.trim().toLowerCase();
  const filtered = mapped.filter((row) => {
    if (opts.product && opts.product !== "all" && row.product !== opts.product) return false;
    if (opts.source && opts.source !== "all" && row.source !== opts.source) return false;
    if (opts.subId && opts.subId !== "all" && row.subId !== opts.subId) return false;
    if (opts.orderType && opts.orderType !== "all") {
      const want = opts.orderType.toLowerCase().replace(/[_-]/g, " ");
      if (want === "front" || want === "front end" || want === "frontend") {
        if (row.orderType !== "Front End") return false;
      } else if (!row.orderType.toLowerCase().includes(want)) {
        return false;
      }
    }
    if (!matchesStatusFilter(row, opts.status)) return false;
    if (q) {
      const hay = `${row.orderId} ${row.product ?? ""} ${row.funnel ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const kpis: PublisherCommissionKpis = {
    orders: 0,
    sales: 0,
    commission: 0,
    refunds: 0,
    frontEndCount: 0,
    upsellCount: 0,
  };

  const byDay = new Map<string, { sales: number; commission: number }>();
  const byType = new Map<string, number>();
  const byProduct = new Map<string, number>();

  for (const row of filtered) {
    const amount = row.amount ?? 0;
    const commission = row.commission ?? 0;
    const day = dayKey(row.date);
    const bucket = byDay.get(day) ?? { sales: 0, commission: 0 };

    if (row.orderType === "Refund") {
      kpis.refunds += amount;
    } else {
      kpis.orders += 1;
      kpis.sales += amount;
      kpis.commission += commission;
      bucket.sales += amount;
      bucket.commission += commission;
      byType.set(row.orderType, (byType.get(row.orderType) ?? 0) + commission);
      if (row.product) byProduct.set(row.product, (byProduct.get(row.product) ?? 0) + commission);
      if (row.orderType === "Front End") kpis.frontEndCount += 1;
      if (row.orderType === "Upsell") kpis.upsellCount += 1;
    }
    byDay.set(day, bucket);
  }

  const start = opts.from ?? (filtered.length ? new Date(filtered[filtered.length - 1]!.date) : new Date());
  const end = opts.to ?? new Date();
  const seriesStart = start <= end ? start : end;
  const seriesEnd = start <= end ? end : start;
  const series: PublisherCommissionChartPoint[] = [];
  const cursor = new Date(seriesStart.getFullYear(), seriesStart.getMonth(), seriesStart.getDate());
  const last = new Date(seriesEnd.getFullYear(), seriesEnd.getMonth(), seriesEnd.getDate());
  while (cursor <= last) {
    const key = dayKey(cursor);
    const bucket = byDay.get(key) ?? { sales: 0, commission: 0 };
    series.push({
      date: key,
      label: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      sales: bucket.sales,
      commission: bucket.commission,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const typeSlices: PublisherCommissionSlice[] = [...byType.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const productSlices: PublisherCommissionSlice[] = [...byProduct.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(page, totalPages);
  const items = filtered.slice((safePage - 1) * limit, safePage * limit);

  return {
    kpis,
    series,
    typeSlices,
    productSlices,
    items,
    total,
    page: safePage,
    limit,
    totalPages,
    filterOptions: { products, sources, subIds },
  };
}
