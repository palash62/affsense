import { prisma } from "@cpl/database";
import type {
  CatalogCategoryStatus,
  DigitalProductStatus,
  Prisma,
} from "@prisma/client";
import { Errors, AppError } from "@/lib/errors";

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

function pickJsonString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return null;
}

function pickJsonNumber(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    if (typeof val === "string") {
      const n = parseFloat(val.replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

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
  if (!payload || typeof payload !== "object") {
    return { orderId: null, product: null, funnel: null, orderType: null, amount: null, source: null, subId: null, paymentStatus: null };
  }
  const p = payload as Record<string, unknown>;
  const purchase = p.purchase && typeof p.purchase === "object" ? p.purchase as Record<string, unknown> : null;
  const contact = p.contact && typeof p.contact === "object" ? p.contact as Record<string, unknown> : null;
  const productObj = p.product && typeof p.product === "object" ? p.product as Record<string, unknown> : null;
  const funnelObj = p.funnel && typeof p.funnel === "object" ? p.funnel as Record<string, unknown> : null;
  const productsArr = Array.isArray(p.products) && p.products.length > 0 && typeof p.products[0] === "object" ? p.products[0] as Record<string, unknown> : null;

  const orderId = pickJsonString(p, ["order_id", "id", "transaction_id"])
    ?? (purchase ? pickJsonString(purchase, ["id", "order_id"]) : null);

  const product = (productObj ? pickJsonString(productObj, ["name", "title"]) : null)
    ?? pickJsonString(p, ["product_name", "product"])
    ?? (productsArr ? pickJsonString(productsArr, ["name", "title"]) : null);

  const funnel = (funnelObj ? pickJsonString(funnelObj, ["name", "title"]) : null)
    ?? pickJsonString(p, ["funnel_name", "funnel"]);

  const orderType = pickJsonString(p, ["purchase_type", "type", "order_type", "event"])
    ?? (purchase ? pickJsonString(purchase, ["purchase_type", "type"]) : null);

  const amount = (purchase ? pickJsonNumber(purchase, ["total", "amount", "price"]) : null)
    ?? pickJsonNumber(p, ["amount", "total", "price"]);

  const source = pickJsonString(p, ["utm_source", "source"])
    ?? (contact ? pickJsonString(contact, ["utm_source", "source"]) : null);

  const subId = pickJsonString(p, ["sub_id", "affiliate_sub_id", "subid"])
    ?? (contact ? pickJsonString(contact, ["sub_id", "subid"]) : null)
    ?? (purchase ? pickJsonString(purchase, ["sub_id"]) : null);

  const paymentStatus = pickJsonString(p, ["payment_status", "charge_status", "payment_state"])
    ?? (purchase ? pickJsonString(purchase, ["payment_status", "charge_status"]) : null);

  return { orderId, product, funnel, orderType, amount, source, subId, paymentStatus };
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
    const amount = fields.amount;
    const commission = amount != null && row.publisherId ? amount * 0.5 : null;
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      customerEmail: row.leadEmail,
      customerName: row.leadName,
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
