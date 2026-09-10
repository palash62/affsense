import { prisma } from "@cpl/database";
import type {
  CatalogCategoryStatus,
  DigitalProductStatus,
  Prisma,
} from "@prisma/client";
import { Errors, AppError } from "@/lib/errors";
import { parseUserAgent } from "@/lib/publisher-leads";
import {
  extractLeadFromClickFunnelsPayload,
  extractOrderFieldsFromClickFunnelsPayload,
} from "@/lib/clickfunnels-webhook-payload";
import { derivePageSlugFromUrl } from "@/lib/digital-product-page-slug";
import { loadDigitalProductCommissionLookup } from "@/lib/digital-product-commission";

export type SerializedDigitalProductUpsell = {
  id: string;
  name: string;
  pageUrl: string;
  pageSlug: string;
  price: number;
  commissionPct: number;
  sortOrder: number;
};

export type DigitalProductUpsellInput = {
  name: string;
  pageUrl: string;
  price: number;
  commissionPct: number;
};

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
  upsells: SerializedDigitalProductUpsell[];
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
  upsells: Array<{ name: string; price: number; commissionPct: number }>;
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

function serializeUpsell(row: {
  id: string;
  name: string;
  pageUrl: string;
  pageSlug: string;
  price: Prisma.Decimal;
  commissionPct: Prisma.Decimal;
  sortOrder: number;
}): SerializedDigitalProductUpsell {
  return {
    id: row.id,
    name: row.name,
    pageUrl: row.pageUrl,
    pageSlug: row.pageSlug,
    price: Number(row.price),
    commissionPct: Number(row.commissionPct),
    sortOrder: row.sortOrder,
  };
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
  upsells?: Array<{
    id: string;
    name: string;
    pageUrl: string;
    pageSlug: string;
    price: Prisma.Decimal;
    commissionPct: Prisma.Decimal;
    sortOrder: number;
  }>;
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
    upsells: (row.upsells ?? []).map(serializeUpsell),
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
    upsells: full.upsells.map((u) => ({
      name: u.name,
      price: u.price,
      commissionPct: u.commissionPct,
    })),
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
      include: {
        category: true,
        upsells: { orderBy: { sortOrder: "asc" } },
      },
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
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) return null;
  return serializePublisherProduct(row);
}

export async function getDigitalProductById(id: string) {
  const row = await prisma.digitalProduct.findUnique({
    where: { id },
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) throw Errors.notFound("Digital product");
  return serializeProduct(row);
}

function normalizeUpsellInputs(raw: DigitalProductUpsellInput[] | undefined): Array<{
  name: string;
  pageUrl: string;
  pageSlug: string;
  price: number;
  commissionPct: number;
  sortOrder: number;
}> {
  if (!raw?.length) return [];

  const seen = new Set<string>();
  const out: Array<{
    name: string;
    pageUrl: string;
    pageSlug: string;
    price: number;
    commissionPct: number;
    sortOrder: number;
  }> = [];

  raw.forEach((item, index) => {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pageUrl = typeof item.pageUrl === "string" ? item.pageUrl.trim() : "";
    if (!name && !pageUrl) return;
    if (!name) throw Errors.validation("Upsell name is required", "upsells");
    if (!pageUrl) throw Errors.validation("Upsell page URL is required", "upsells");

    const pageSlug = derivePageSlugFromUrl(pageUrl);
    if (!pageSlug) {
      throw Errors.validation(
        `Could not derive page slug from upsell URL: ${pageUrl}`,
        "upsells",
      );
    }
    if (seen.has(pageSlug)) {
      throw Errors.validation(
        `Duplicate upsell page slug "${pageSlug}" on this product`,
        "upsells",
      );
    }
    seen.add(pageSlug);

    const price = Number(item.price);
    const commissionPct = Number(item.commissionPct);
    if (!Number.isFinite(price) || price < 0) {
      throw Errors.validation("Upsell price must be zero or greater", "upsells");
    }
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > 100) {
      throw Errors.validation("Upsell commission must be between 0 and 100", "upsells");
    }

    out.push({
      name,
      pageUrl,
      pageSlug,
      price,
      commissionPct,
      sortOrder: index,
    });
  });

  return out;
}

async function replaceProductUpsells(
  productId: string,
  upsells: ReturnType<typeof normalizeUpsellInputs>,
) {
  await prisma.$transaction(async (tx) => {
    await tx.digitalProductUpsell.deleteMany({ where: { productId } });
    if (upsells.length === 0) return;
    await tx.digitalProductUpsell.createMany({
      data: upsells.map((row) => ({
        productId,
        name: row.name,
        pageUrl: row.pageUrl,
        pageSlug: row.pageSlug,
        price: row.price,
        commissionPct: row.commissionPct,
        sortOrder: row.sortOrder,
      })),
    });
  });
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
  upsellCommission?: number | null;
  referralReward?: number;
  price: number;
  vendor?: string;
  webhookSecret?: string;
  imageUrl?: string | null;
  thumbTone?: string;
  upsells?: DigitalProductUpsellInput[];
}) {
  const upsells = normalizeUpsellInputs(input.upsells);
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
      upsells:
        upsells.length > 0
          ? {
              create: upsells.map((u) => ({
                name: u.name,
                pageUrl: u.pageUrl,
                pageSlug: u.pageSlug,
                price: u.price,
                commissionPct: u.commissionPct,
                sortOrder: u.sortOrder,
              })),
            }
          : undefined,
    },
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
    },
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
    upsellCommission: number | null;
    referralReward: number;
    price: number;
    vendor: string;
    webhookSecret: string;
    imageUrl: string | null;
    thumbTone: string;
    upsells: DigitalProductUpsellInput[];
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

  if (Object.prototype.hasOwnProperty.call(input, "upsells")) {
    await replaceProductUpsells(id, normalizeUpsellInputs(input.upsells));
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
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
    },
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
  pageSlug: string | null;
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

/** Prefer PROCESSED + attributed + newest when collapsing duplicate CF webhook events. */
function preferOrderRow(a: DigitalProductOrderRow, b: DigitalProductOrderRow): boolean {
  const aProcessed = a.webhookStatus === "PROCESSED" ? 1 : 0;
  const bProcessed = b.webhookStatus === "PROCESSED" ? 1 : 0;
  if (aProcessed !== bProcessed) return aProcessed > bProcessed;
  const aPub = a.affiliateName || a.affiliateRef ? 1 : 0;
  const bPub = b.affiliateName || b.affiliateRef ? 1 : 0;
  if (aPub !== bPub) return aPub > bPub;
  return a.date > b.date;
}

export function dedupeDigitalProductOrderRows(
  rows: DigitalProductOrderRow[],
): DigitalProductOrderRow[] {
  const best = new Map<string, DigitalProductOrderRow>();
  for (const row of rows) {
    const key = row.orderId?.trim() || row.id;
    const existing = best.get(key);
    if (!existing || preferOrderRow(row, existing)) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function summarizeDigitalProductOrders(
  rows: Array<{
    publisherId: string | null;
    eventType: string;
    payloadJson: unknown;
    orderId: string | null;
  }>,
  commissionLookup: Awaited<ReturnType<typeof loadDigitalProductCommissionLookup>>,
): DigitalProductOrderSummary {
  // Collapse by order id so retries don't inflate revenue / affiliate sales.
  // Caller should pass newest-first; first attributed row wins, else first seen.
  const best = new Map<
    string,
    {
      publisherId: string | null;
      eventType: string;
      payloadJson: unknown;
    }
  >();
  for (const [idx, ev] of rows.entries()) {
    const fields = extractOrderFields(ev.payloadJson);
    const orderId = fields.orderId ?? `idx-${idx}`;
    const existing = best.get(orderId);
    if (!existing) {
      best.set(orderId, {
        publisherId: ev.publisherId,
        eventType: ev.eventType,
        payloadJson: ev.payloadJson,
      });
      continue;
    }
    if (!existing.publisherId && ev.publisherId) {
      best.set(orderId, {
        publisherId: ev.publisherId,
        eventType: ev.eventType,
        payloadJson: ev.payloadJson,
      });
    }
  }

  let grossRevenue = 0;
  let affiliateSales = 0;
  let totalCommissions = 0;
  let refunds = 0;

  for (const ev of best.values()) {
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
      const resolved = commissionLookup.resolve(fields.pageSlug, amount);
      totalCommissions += resolved.commission ?? 0;
    }
  }

  return {
    totalOrders: best.size,
    grossRevenue,
    affiliateSales,
    totalCommissions,
    netRevenue: grossRevenue - totalCommissions - refunds,
    refunds,
  };
}

export async function listDigitalProductOrders(opts: {
  from?: Date;
  to?: Date;
  publisherId?: string;
  subId?: string;
  eventType?: string;
  page?: number;
  limit?: number;
} = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 15));
  const skip = (page - 1) * limit;
  const subIdFilter = opts.subId?.trim() || undefined;

  const where: Prisma.WebhookEventWhereInput = {};
  if (opts.from || opts.to) {
    where.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.publisherId) where.publisherId = opts.publisherId;
  if (opts.eventType) where.eventType = { contains: opts.eventType };

  const select = {
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
  } as const;

  const commissionLookup = await loadDigitalProductCommissionLookup();

  const mapRow = (row: {
    id: string;
    eventType: string;
    status: string;
    leadEmail: string | null;
    leadName: string | null;
    affiliateRef: string | null;
    publisherId: string | null;
    publisher: { id: string; name: string; email: string } | null;
    payloadJson: unknown;
    createdAt: Date;
  }): DigitalProductOrderRow => {
    const fields = extractOrderFields(row.payloadJson);
    const leadFallback = extractLeadFromClickFunnelsPayload(row.payloadJson);
    const amount = fields.amount;
    const resolved = commissionLookup.resolve(fields.pageSlug, amount);
    const commission =
      amount != null && row.publisherId ? resolved.commission : null;
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      customerEmail: row.leadEmail ?? leadFallback.leadEmail,
      customerName: row.leadName ?? leadFallback.leadName,
      product: resolved.productName ?? fields.product,
      funnel: fields.funnel,
      orderType:
        resolved.orderType ??
        normalizeOrderType(fields.orderType ?? row.eventType),
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
  };

  // Load a window, map, dedupe by orderId, then paginate in memory
  // (CF retries create multiple webhook_events per purchase).
  const [allRows, allForSummary] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select,
    }),
    prisma.webhookEvent.findMany({
      where: { ...where, status: "PROCESSED" },
      select: { publisherId: true, eventType: true, payloadJson: true },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  let mapped = allRows.map(mapRow);
  if (subIdFilter) {
    mapped = mapped.filter((row) => row.subId === subIdFilter);
  }
  const dedupedItems = dedupeDigitalProductOrderRows(mapped);

  const summarySource = subIdFilter
    ? allForSummary.filter(
        (ev) => extractOrderFields(ev.payloadJson).subId === subIdFilter,
      )
    : allForSummary;
  const summary = summarizeDigitalProductOrders(
    summarySource.map((ev) => ({
      publisherId: ev.publisherId,
      eventType: ev.eventType,
      payloadJson: ev.payloadJson,
      orderId: extractOrderFields(ev.payloadJson).orderId,
    })),
    commissionLookup,
  );

  const total = dedupedItems.length;
  const items = dedupedItems.slice(skip, skip + limit);
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
}

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

  const commissionLookup = await loadDigitalProductCommissionLookup();

  const mapped: PublisherCommissionRow[] = events.map((row) => {
    const fields = extractOrderFields(row.payloadJson);
    const resolved = commissionLookup.resolve(fields.pageSlug, fields.amount);
    const orderType =
      resolved.orderType ??
      classifyCommissionType(fields.orderType ?? row.eventType, row.eventType);
    const amount = fields.amount;
    const isRefund = orderType === "Refund";
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      product: resolved.productName ?? fields.product,
      funnel: fields.funnel,
      orderType,
      amount,
      commission:
        amount != null && !isRefund
          ? resolved.commission
          : isRefund
            ? 0
            : null,
      rate: isRefund ? 0 : resolved.rate,
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

export type SerializedDigitalProductClick = {
  id: string;
  productId: string;
  productName: string;
  publisherId: string;
  publisherName: string | null;
  publisherEmail: string | null;
  src: string | null;
  subId: string | null;
  campaign: string | null;
  ip: string | null;
  device: string;
  browser: string;
  createdAt: string;
};

export type DigitalProductClickListStats = {
  hits: number;
  clicks: number;
};

export type DigitalProductClickListResult = {
  items: SerializedDigitalProductClick[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: DigitalProductClickListStats;
};

export type DigitalProductClickListFilters = {
  q?: string;
  productId?: string;
  subId?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

async function digitalProductClickWindowStats(
  where: Prisma.DigitalProductClickWhereInput,
): Promise<DigitalProductClickListStats> {
  const [hits, ipGroups] = await Promise.all([
    prisma.digitalProductClick.count({ where }),
    prisma.digitalProductClick.groupBy({
      by: ["ip"],
      where: { ...where, ip: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const uniqueIpCount = ipGroups.length;
  return { hits, clicks: uniqueIpCount > 0 ? uniqueIpCount : hits };
}

function serializeDigitalProductClick(row: {
  id: string;
  productId: string;
  publisherId: string;
  src: string | null;
  subId: string | null;
  campaign: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  product: { name: string };
  publisher: { name: string; email: string } | null;
}): SerializedDigitalProductClick {
  const { device, browser } = parseUserAgent(row.userAgent);
  return {
    id: row.id,
    productId: row.productId,
    productName: row.product.name,
    publisherId: row.publisherId,
    publisherName: row.publisher?.name ?? null,
    publisherEmail: row.publisher?.email ?? null,
    src: row.src,
    subId: row.subId,
    campaign: row.campaign,
    ip: row.ip,
    device,
    browser,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildDigitalProductClickWhere(
  filters: DigitalProductClickListFilters,
  forcedPublisherId?: string,
): Prisma.DigitalProductClickWhereInput {
  const where: Prisma.DigitalProductClickWhereInput = {};
  if (forcedPublisherId) where.publisherId = forcedPublisherId;

  const productId = filters.productId?.trim();
  if (productId) where.productId = productId;

  const subId = filters.subId?.trim();
  if (subId) where.subId = subId;

  const publisherId = filters.publisherId?.trim();
  if (publisherId && !forcedPublisherId) where.publisherId = publisherId;

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
      { productId: { contains: q } },
      { product: { name: { contains: q } } },
      { src: { contains: q } },
      { subId: { contains: q } },
      { campaign: { contains: q } },
      { ip: { contains: q } },
      ...(forcedPublisherId
        ? []
        : [
            { publisher: { name: { contains: q } } },
            { publisher: { email: { contains: q } } },
          ]),
    ];
  }

  return where;
}

export async function listDigitalProductClicksForAdmin(
  filters: DigitalProductClickListFilters,
): Promise<DigitalProductClickListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where = buildDigitalProductClickWhere(filters);

  const [total, rows, stats] = await Promise.all([
    prisma.digitalProductClick.count({ where }),
    prisma.digitalProductClick.findMany({
      where,
      include: {
        product: { select: { name: true } },
        publisher: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    digitalProductClickWindowStats(where),
  ]);

  return {
    items: rows.map(serializeDigitalProductClick),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function listDigitalProductClicksForPublisher(
  publisherId: string,
  filters: DigitalProductClickListFilters,
): Promise<DigitalProductClickListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const where = buildDigitalProductClickWhere(filters, publisherId);

  const [total, rows, stats] = await Promise.all([
    prisma.digitalProductClick.count({ where }),
    prisma.digitalProductClick.findMany({
      where,
      include: {
        product: { select: { name: true } },
        publisher: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    digitalProductClickWindowStats(where),
  ]);

  return {
    items: rows.map(serializeDigitalProductClick),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    stats,
  };
}

export async function listPublisherDigitalProductOrders(
  publisherId: string,
  opts: {
    q?: string;
    productId?: string;
    subId?: string;
    eventType?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const from = opts.from ? new Date(opts.from) : undefined;
  const to = opts.to ? new Date(opts.to) : undefined;
  const result = await listDigitalProductOrders({
    publisherId,
    subId: opts.subId,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    eventType: opts.eventType,
    page: opts.page,
    limit: opts.limit ?? 20,
  });

  const q = opts.q?.trim().toLowerCase();
  const productId = opts.productId?.trim().toLowerCase();
  let items = result.items;
  if (q || productId) {
    items = items.filter((row) => {
      if (productId) {
        const hay = `${row.product ?? ""}`.toLowerCase();
        if (!hay.includes(productId)) return false;
      }
      if (q) {
        const hay = `${row.orderId} ${row.product ?? ""} ${row.funnel ?? ""} ${row.source ?? ""} ${row.subId ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  return {
    ...result,
    items,
    total: q || productId ? items.length : result.total,
    totalPages:
      q || productId
        ? Math.max(1, Math.ceil(items.length / (opts.limit ?? 20)))
        : result.totalPages,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function moneyToString(n: number) {
  return round2(n).toFixed(2);
}

function normalizeProductNameKey(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase();
}

export type SerializedDigitalProductAffiliateReportRow = {
  publisherId: string;
  publisherName: string;
  productId: string | null;
  productName: string;
  subId: string | null;
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: string;
  commission: string;
  revenue: string;
  profit: string;
};

export type DigitalProductAffiliateReportStats = {
  clicks: number;
  conversions: number;
  conversionRate: number;
  epc: string;
  commission: string;
  revenue: string;
  profit: string;
};

export type DigitalProductAffiliateReportResult = {
  items: SerializedDigitalProductAffiliateReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: DigitalProductAffiliateReportStats;
};

export async function listDigitalProductAffiliateProductReportForAdmin(
  filters: DigitalProductClickListFilters,
): Promise<DigitalProductAffiliateReportResult> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

  const clickWhere = buildDigitalProductClickWhere(filters);

  const webhookWhere: Prisma.WebhookEventWhereInput = {
    status: "PROCESSED",
    publisherId: { not: null },
  };

  const publisherId = filters.publisherId?.trim();
  if (publisherId) webhookWhere.publisherId = publisherId;

  if (filters.from || filters.to) {
    webhookWhere.createdAt = {};
    if (filters.from) {
      const from = new Date(filters.from);
      if (!Number.isNaN(from.getTime())) webhookWhere.createdAt.gte = from;
    }
    if (filters.to) {
      const to = new Date(filters.to);
      if (!Number.isNaN(to.getTime())) webhookWhere.createdAt.lte = to;
    }
  }

  const catalogProducts = await prisma.digitalProduct.findMany({
    select: { id: true, name: true },
  });
  const commissionLookup = await loadDigitalProductCommissionLookup();
  const productById = new Map(catalogProducts.map((p) => [p.id, p]));
  const productIdByName = new Map<string, string>();
  for (const p of catalogProducts) {
    const key = normalizeProductNameKey(p.name);
    if (key && !productIdByName.has(key)) productIdByName.set(key, p.id);
  }

  const filterProductId = filters.productId?.trim();
  const filterProductName = filterProductId
    ? productById.get(filterProductId)?.name ?? null
    : null;
  const filterProductNameKey = normalizeProductNameKey(filterProductName);
  const filterSubId = filters.subId?.trim() || undefined;

  const q = filters.q?.trim().toLowerCase();

  const [clickGroups, orderEvents] = await Promise.all([
    prisma.digitalProductClick.groupBy({
      by: ["publisherId", "productId", "subId"],
      where: clickWhere,
      _count: { _all: true },
    }),
    prisma.webhookEvent.findMany({
      where: webhookWhere,
      select: {
        publisherId: true,
        eventType: true,
        payloadJson: true,
      },
      take: 10000,
    }),
  ]);

  type Acc = {
    publisherId: string;
    productId: string | null;
    productName: string;
    nameKey: string;
    subId: string | null;
    clicks: number;
    conversions: number;
    commission: number;
    revenue: number;
  };

  const byKey = new Map<string, Acc>();
  const keyOf = (
    publisherId: string,
    productId: string | null,
    nameKey: string,
    subId: string | null,
  ) => {
    const productPart = productId
      ? `id::${productId}`
      : `name::${nameKey || "_"}`;
    return `${publisherId}::${productPart}::${subId ?? ""}`;
  };

  for (const g of clickGroups) {
    const product = productById.get(g.productId);
    const productName = product?.name ?? g.productId;
    const nameKey = normalizeProductNameKey(productName);
    const key = keyOf(g.publisherId, g.productId, nameKey, g.subId);
    byKey.set(key, {
      publisherId: g.publisherId,
      productId: g.productId,
      productName,
      nameKey,
      subId: g.subId,
      clicks: g._count._all,
      conversions: 0,
      commission: 0,
      revenue: 0,
    });
  }

  for (const ev of orderEvents) {
    if (!ev.publisherId) continue;
    const fields = extractOrderFields(ev.payloadJson);
    const type = (fields.orderType ?? ev.eventType ?? "").toLowerCase();
    if (type.includes("refund")) continue;

    const orderSubId = fields.subId ?? null;
    if (filterSubId && orderSubId !== filterSubId) continue;

    const amount = fields.amount ?? 0;
    const resolved = commissionLookup.resolve(fields.pageSlug, amount);
    const productName =
      (resolved.productName ?? fields.product?.trim()) || "Unknown product";
    const nameKey = normalizeProductNameKey(productName);
    const matchedProductId =
      resolved.productId ??
      (nameKey ? productIdByName.get(nameKey) ?? null : null);

    if (filterProductId) {
      if (matchedProductId) {
        if (matchedProductId !== filterProductId) continue;
      } else if (!filterProductNameKey || nameKey !== filterProductNameKey) {
        if (!nameKey.includes(filterProductId.toLowerCase())) continue;
      }
    }

    if (q) {
      const hay = `${productName} ${matchedProductId ?? ""} ${ev.publisherId} ${orderSubId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const key = keyOf(ev.publisherId, matchedProductId, nameKey, orderSubId);
    const acc = byKey.get(key) ?? {
      publisherId: ev.publisherId,
      productId: matchedProductId,
      productName: matchedProductId
        ? productById.get(matchedProductId)?.name ?? productName
        : productName,
      nameKey,
      subId: orderSubId,
      clicks: 0,
      conversions: 0,
      commission: 0,
      revenue: 0,
    };

    acc.conversions += 1;
    acc.revenue += amount;
    acc.commission += resolved.commission ?? 0;
    if (resolved.productId && !acc.productId) {
      acc.productId = resolved.productId;
      acc.productName = resolved.productName ?? acc.productName;
      acc.nameKey = normalizeProductNameKey(acc.productName);
    }
    byKey.set(key, acc);
  }

  // Apply q filter to click-only rows (orders already filtered above)
  if (q) {
    for (const [key, acc] of [...byKey.entries()]) {
      if (acc.conversions > 0) continue;
      const hay = `${acc.productName} ${acc.productId ?? ""} ${acc.publisherId} ${acc.subId ?? ""}`.toLowerCase();
      if (!hay.includes(q)) byKey.delete(key);
    }
  }

  const publisherIds = Array.from(new Set([...byKey.values()].map((r) => r.publisherId)));
  const publishers = publisherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: publisherIds } },
        select: { id: true, name: true },
      })
    : [];
  const publisherNameById = new Map(publishers.map((p) => [p.id, p.name]));

  const allRows: SerializedDigitalProductAffiliateReportRow[] = Array.from(byKey.values())
    .map((acc) => {
      const clicks = acc.clicks;
      const conversions = acc.conversions;
      const commission = round2(acc.commission);
      const revenue = round2(acc.revenue);
      const profit = round2(revenue - commission);
      const conversionRate =
        clicks > 0 ? Math.round((conversions / clicks) * 10000) / 100 : 0;
      const epc = clicks > 0 ? round2(commission / clicks) : 0;

      return {
        publisherId: acc.publisherId,
        publisherName: publisherNameById.get(acc.publisherId) ?? "Unknown",
        productId: acc.productId,
        productName: acc.productName,
        subId: acc.subId,
        clicks,
        conversions,
        conversionRate,
        epc: moneyToString(epc),
        commission: moneyToString(commission),
        revenue: moneyToString(revenue),
        profit: moneyToString(profit),
      };
    })
    .sort((a, b) => {
      const byPub = a.publisherName.localeCompare(b.publisherName);
      if (byPub !== 0) return byPub;
      const byProduct = a.productName.localeCompare(b.productName);
      if (byProduct !== 0) return byProduct;
      return (a.subId ?? "").localeCompare(b.subId ?? "");
    });

  const totals = allRows.reduce(
    (sum, row) => {
      sum.clicks += row.clicks;
      sum.conversions += row.conversions;
      sum.commission += Number(row.commission);
      sum.revenue += Number(row.revenue);
      return sum;
    },
    { clicks: 0, conversions: 0, commission: 0, revenue: 0 },
  );

  const totalCommission = round2(totals.commission);
  const totalRevenue = round2(totals.revenue);
  const totalProfit = round2(totalRevenue - totalCommission);
  const totalCr =
    totals.clicks > 0
      ? Math.round((totals.conversions / totals.clicks) * 10000) / 100
      : 0;
  const totalEpc = totals.clicks > 0 ? round2(totalCommission / totals.clicks) : 0;

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
      commission: moneyToString(totalCommission),
      revenue: moneyToString(totalRevenue),
      profit: moneyToString(totalProfit),
    },
  };
}

/** Publisher-scoped affiliate × product report — forces session publisherId. */
export async function listDigitalProductAffiliateProductReportForPublisher(
  publisherId: string,
  filters: Omit<DigitalProductClickListFilters, "publisherId">,
): Promise<DigitalProductAffiliateReportResult> {
  return listDigitalProductAffiliateProductReportForAdmin({
    ...filters,
    publisherId,
  });
}
