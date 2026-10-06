import { prisma } from "@cpl/database";
import type {
  CatalogCategoryStatus,
  DigitalProductStatus,
  Prisma,
} from "@prisma/client";
import { formatMemberId } from "@cpl/shared";
import { Errors, AppError } from "@/lib/errors";
import { parseUserAgent } from "@/lib/publisher-leads";
import { buildReportOrderBy, sortRows, type SortDir } from "@/lib/report-sort";
import {
  extractLeadFromClickFunnelsPayload,
  extractOrderFieldsFromClickFunnelsPayload,
} from "@/lib/clickfunnels-webhook-payload";
import { DIGITAL_PRODUCT_CLICK_ATTRIBUTION_WINDOW_MS } from "@/lib/clickfunnels-webhook-attribution";
import { derivePageSlugFromUrl } from "@/lib/digital-product-page-slug";
import {
  applyDigitalCommissionSnapshot,
  loadDigitalProductCommissionLookup,
  loadPublisherDigitalPlanRates,
  resolveDigitalProductForEvent,
  type DigitalCommissionPlanRates,
  type DigitalCommissionSnapshot,
} from "@/lib/digital-product-commission";

async function loadDigitalProductNameMap(): Promise<Map<string, string>> {
  const rows = await prisma.digitalProduct.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((row) => [row.id, row.name]));
}

const DIGITAL_COMMISSION_SNAPSHOT_SELECT = {
  digitalProductId: true,
  externalEventKey: true,
  commissionAmount: true,
  commissionRate: true,
  digitalCommissionPlanId: true,
} as const;

export type SerializedDigitalProductUpsell = {
  id: string;
  name: string;
  pageUrl: string;
  pageSlug: string;
  price: number;
  commissionPct: number;
  sortOrder: number;
  cfProductId: string | null;
  cfProductName: string | null;
};

export type DigitalProductUpsellInput = {
  name: string;
  pageUrl: string;
  price: number;
  commissionPct: number;
  cfProductId?: string | null;
  cfProductName?: string | null;
};

type CfMappingRow = { cfProductId: string; cfProductName: string | null; upsellId: string | null };

export type SerializedDigitalProductSalesPage = {
  id: string;
  name: string;
  pageUrl: string;
};

export type DigitalProductSalesPageInput = {
  name: string;
  pageUrl: string;
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
  lifetimeCookie: boolean;
  isPrivate: boolean;
  /** Publishers allowed to see a private product (admin view). */
  allowedAffiliates: Array<{ id: string; name: string; email: string; memberId: string }>;
  previewUrl: string | null;
  webhookSecret: string | null;
  /** ClickFunnels product mapped to this product's front end. */
  cfProductId: string | null;
  cfProductName: string | null;
  upsells: SerializedDigitalProductUpsell[];
  salesPages: SerializedDigitalProductSalesPage[];
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
  lifetimeCookie: boolean;
  previewUrl: string | null;
  upsells: Array<{ name: string; price: number; commissionPct: number }>;
  salesPages: SerializedDigitalProductSalesPage[];
  /** True when commission rates come from the viewing publisher's custom plan. */
  hasCommissionPlan: boolean;
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

function serializeUpsell(
  row: {
    id: string;
    name: string;
    pageUrl: string;
    pageSlug: string;
    price: Prisma.Decimal;
    commissionPct: Prisma.Decimal;
    sortOrder: number;
  },
  mappings: CfMappingRow[] = [],
): SerializedDigitalProductUpsell {
  const mapping = mappings.find((m) => m.upsellId === row.id);
  return {
    id: row.id,
    name: row.name,
    pageUrl: row.pageUrl,
    pageSlug: row.pageSlug,
    price: Number(row.price),
    commissionPct: Number(row.commissionPct),
    sortOrder: row.sortOrder,
    cfProductId: mapping?.cfProductId ?? null,
    cfProductName: mapping?.cfProductName ?? null,
  };
}

function serializeProduct(row: {
  id: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  productType: string;
  status: DigitalProductStatus;
  featured: boolean;
  isNew: boolean;
  salesPageUrl: string | null;
  affiliateTrackingParam: string | null;
  lifetimeCookie: boolean;
  isPrivate: boolean;
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
  salesPages?: Array<{ id: string; name: string; pageUrl: string }>;
  cfMappings?: CfMappingRow[];
  allowedPublishers?: Array<{
    publisher: { id: string; name: string; email: string; memberNo: number };
  }>;
}): SerializedDigitalProduct {
  const mappings = row.cfMappings ?? [];
  const frontEndMapping = mappings.find((m) => !m.upsellId);
  return {
    id: row.id,
    name: row.name,
    category: row.category.name,
    categoryId: row.categoryId,
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
    lifetimeCookie: row.lifetimeCookie,
    isPrivate: row.isPrivate,
    allowedAffiliates: (row.allowedPublishers ?? []).map(({ publisher: { memberNo, ...p } }) => ({
      ...p,
      memberId: formatMemberId(memberNo),
    })),
    previewUrl: row.previewUrl,
    webhookSecret: row.webhookSecret,
    cfProductId: frontEndMapping?.cfProductId ?? null,
    cfProductName: frontEndMapping?.cfProductName ?? null,
    upsells: (row.upsells ?? []).map((upsell) => serializeUpsell(upsell, mappings)),
    salesPages: (row.salesPages ?? []).map((page) => ({
      id: page.id,
      name: page.name,
      pageUrl: page.pageUrl,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ProductRow = Parameters<typeof serializeProduct>[0];

function serializePublisherProduct(
  row: ProductRow,
  plan?: DigitalCommissionPlanRates,
): SerializedPublisherDigitalProduct {
  const full = serializeProduct(row);
  return {
    id: full.id,
    name: full.name,
    category: full.category,
    productType: full.productType,
    price: full.price,
    frontEndCommission: plan ? plan.frontEndCommission : full.frontEndCommission,
    upsellCommission: full.upsellCommission,
    featured: full.featured,
    isNew: full.isNew,
    thumbTone: full.thumbTone,
    vendor: full.vendor,
    imageUrl: full.imageUrl,
    shortDescription: full.shortDescription,
    salesPageUrl: full.salesPageUrl,
    affiliateTrackingParam: full.affiliateTrackingParam,
    lifetimeCookie: full.lifetimeCookie,
    previewUrl: full.previewUrl,
    upsells: full.upsells.map((u) => ({
      name: u.name,
      price: u.price,
      commissionPct: plan?.upsellRates.get(u.id) ?? u.commissionPct,
    })),
    salesPages: full.salesPages,
    hasCommissionPlan: Boolean(plan),
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

export async function listPublisherDigitalProducts(
  filters: DigitalProductListFilters = {},
  publisherId?: string,
) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 100;
  const where: Prisma.DigitalProductWhereInput = {
    AND: [buildProductWhere({ ...filters, activeOnly: true }), publisherVisibleProductWhere(publisherId)],
  };
  const [rows, total] = await Promise.all([
    prisma.digitalProduct.findMany({
      where,
      include: {
        category: true,
        upsells: { orderBy: { sortOrder: "asc" } },
        salesPages: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.digitalProduct.count({ where }),
  ]);
  const plans = publisherId
    ? await loadPublisherDigitalPlanRates(publisherId, rows.map((row) => row.id))
    : new Map<string, DigitalCommissionPlanRates>();
  return {
    items: rows.map((row) => serializePublisherProduct(row, plans.get(row.id))),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getPublisherDigitalProduct(id: string, publisherId?: string) {
  const row = await prisma.digitalProduct.findFirst({
    where: { id, status: "ACTIVE", ...publisherVisibleProductWhere(publisherId) },
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
      salesPages: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) return null;
  const plans = publisherId
    ? await loadPublisherDigitalPlanRates(publisherId, [row.id])
    : undefined;
  return serializePublisherProduct(row, plans?.get(row.id));
}

const CF_MAPPINGS_INCLUDE = {
  select: { cfProductId: true, cfProductName: true, upsellId: true },
} as const;

export async function getDigitalProductById(id: string) {
  const row = await prisma.digitalProduct.findUnique({
    where: { id },
    include: {
      category: true,
      upsells: { orderBy: { sortOrder: "asc" } },
      salesPages: { orderBy: { sortOrder: "asc" } },
      cfMappings: CF_MAPPINGS_INCLUDE,
      allowedPublishers: {
        orderBy: { createdAt: "asc" },
        select: { publisher: { select: { id: true, name: true, email: true, memberNo: true } } },
      },
    },
  });
  if (!row) throw Errors.notFound("Digital product");
  return serializeProduct(row);
}

/** Replace a product's allowlist with `publisherIds` (publishers only). */
async function replaceProductAllowedPublishers(productId: string, publisherIds: string[]) {
  const wanted = await prisma.user.findMany({
    where: {
      id: { in: [...new Set(publisherIds.filter((id) => typeof id === "string"))] },
      role: "PUBLISHER",
    },
    select: { id: true },
  });
  await prisma.$transaction([
    prisma.digitalProductAllowedPublisher.deleteMany({ where: { productId } }),
    prisma.digitalProductAllowedPublisher.createMany({
      data: wanted.map((u) => ({ productId, publisherId: u.id })),
    }),
  ]);
}

/** Public products, plus private ones the publisher is allowed to see. */
function publisherVisibleProductWhere(publisherId?: string): Prisma.DigitalProductWhereInput {
  if (!publisherId) return { isPrivate: false };
  return { OR: [{ isPrivate: false }, { allowedPublishers: { some: { publisherId } } }] };
}

export async function publisherCanSeeDigitalProduct(productId: string, publisherId: string) {
  const count = await prisma.digitalProduct.count({
    where: { id: productId, ...publisherVisibleProductWhere(publisherId) },
  });
  return count > 0;
}

type NormalizedUpsellInput = {
  name: string;
  pageUrl: string;
  pageSlug: string;
  price: number;
  commissionPct: number;
  sortOrder: number;
  cfProductId: string | null;
  cfProductName: string | null;
};

function normalizeCfProductId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 191) : null;
}

function normalizeCfProductName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 191) : null;
}

function normalizeUpsellInputs(raw: DigitalProductUpsellInput[] | undefined): NormalizedUpsellInput[] {
  if (!raw?.length) return [];

  const seen = new Set<string>();
  const out: NormalizedUpsellInput[] = [];

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

    const cfProductId = normalizeCfProductId(item.cfProductId);
    out.push({
      name,
      pageUrl,
      pageSlug,
      price,
      commissionPct,
      sortOrder: index,
      cfProductId,
      cfProductName: cfProductId ? normalizeCfProductName(item.cfProductName) : null,
    });
  });

  return out;
}

/** Validate CF product IDs are unique in this product and not mapped to another product. */
async function assertCfMappingsAvailable(
  productId: string | null,
  frontEndCfProductId: string | null,
  upsells: NormalizedUpsellInput[],
) {
  const ids = [frontEndCfProductId, ...upsells.map((u) => u.cfProductId)].filter(
    (v): v is string => Boolean(v),
  );
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw Errors.validation(
        `ClickFunnels product ${id} is selected more than once on this product`,
        "cfProductId",
      );
    }
    seen.add(id);
  }
  if (ids.length === 0) return;
  const taken = await prisma.digitalProductCfMapping.findMany({
    where: {
      cfProductId: { in: ids },
      ...(productId ? { productId: { not: productId } } : {}),
    },
    select: { cfProductId: true, product: { select: { name: true } } },
  });
  if (taken.length > 0) {
    const first = taken[0]!;
    throw Errors.validation(
      `ClickFunnels product ${first.cfProductId} is already mapped to "${first.product.name}"`,
      "cfProductId",
    );
  }
}

/** Replace all CF mappings for a product (front end + upsells matched by page slug). */
async function syncProductCfMappings(
  productId: string,
  frontEnd: { cfProductId: string | null; cfProductName: string | null },
  upsells: NormalizedUpsellInput[],
) {
  await prisma.$transaction(async (tx) => {
    const upsellRows = await tx.digitalProductUpsell.findMany({
      where: { productId },
      select: { id: true, pageSlug: true },
    });
    const upsellIdBySlug = new Map(upsellRows.map((row) => [row.pageSlug, row.id]));
    const rows: Array<{ cfProductId: string; cfProductName: string | null; upsellId: string | null }> =
      [];
    if (frontEnd.cfProductId) {
      rows.push({
        cfProductId: frontEnd.cfProductId,
        cfProductName: frontEnd.cfProductName,
        upsellId: null,
      });
    }
    for (const upsell of upsells) {
      const upsellId = upsellIdBySlug.get(upsell.pageSlug);
      if (!upsell.cfProductId || !upsellId) continue;
      rows.push({
        cfProductId: upsell.cfProductId,
        cfProductName: upsell.cfProductName,
        upsellId,
      });
    }
    await tx.digitalProductCfMapping.deleteMany({ where: { productId } });
    if (rows.length > 0) {
      await tx.digitalProductCfMapping.createMany({
        data: rows.map((row) => ({ ...row, productId })),
      });
    }
  });
}

async function replaceProductUpsells(
  productId: string,
  upsells: ReturnType<typeof normalizeUpsellInputs>,
) {
  // Update in place by page slug so upsell ids (and commission plan rates) survive edits.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.digitalProductUpsell.findMany({
      where: { productId },
      select: { id: true, pageSlug: true },
    });
    const idBySlug = new Map(existing.map((row) => [row.pageSlug, row.id]));
    await tx.digitalProductUpsell.deleteMany({
      where: { productId, pageSlug: { notIn: upsells.map((row) => row.pageSlug) } },
    });
    for (const row of upsells) {
      const data = {
        name: row.name,
        pageUrl: row.pageUrl,
        pageSlug: row.pageSlug,
        price: row.price,
        commissionPct: row.commissionPct,
        sortOrder: row.sortOrder,
      };
      const id = idBySlug.get(row.pageSlug);
      if (id) {
        await tx.digitalProductUpsell.update({ where: { id }, data });
      } else {
        await tx.digitalProductUpsell.create({ data: { productId, ...data } });
      }
    }
  });
}

function normalizeSalesPageInputs(
  raw: DigitalProductSalesPageInput[] | undefined,
  mainSalesPageUrl: string | null | undefined,
  upsellSlugs: string[],
): Array<{ name: string; pageUrl: string; pageSlug: string; sortOrder: number }> {
  if (!raw?.length) return [];

  const mainSlug = derivePageSlugFromUrl(mainSalesPageUrl);
  const upsellSlugSet = new Set(upsellSlugs);
  const seen = new Set<string>();
  const out: Array<{ name: string; pageUrl: string; pageSlug: string; sortOrder: number }> = [];

  raw.forEach((item) => {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const pageUrl = typeof item.pageUrl === "string" ? item.pageUrl.trim() : "";
    if (!name && !pageUrl) return;
    if (!name) throw Errors.validation("Sales page name is required", "salesPages");
    if (!pageUrl) throw Errors.validation("Sales page URL is required", "salesPages");

    const pageSlug = derivePageSlugFromUrl(pageUrl);
    if (!pageSlug) {
      throw Errors.validation(
        `Could not derive page slug from sales page URL: ${pageUrl}`,
        "salesPages",
      );
    }
    if (pageSlug === mainSlug) {
      throw Errors.validation(
        `Sales page "${name}" uses the same page slug as the main sales page`,
        "salesPages",
      );
    }
    if (upsellSlugSet.has(pageSlug)) {
      throw Errors.validation(
        `Sales page "${name}" uses the same page slug as an upsell`,
        "salesPages",
      );
    }
    if (seen.has(pageSlug)) {
      throw Errors.validation(
        `Duplicate sales page slug "${pageSlug}" on this product`,
        "salesPages",
      );
    }
    seen.add(pageSlug);
    out.push({ name, pageUrl, pageSlug, sortOrder: out.length });
  });

  return out;
}

async function replaceProductSalesPages(
  productId: string,
  salesPages: ReturnType<typeof normalizeSalesPageInputs>,
) {
  // Update in place by page slug so page ids (used in publisher links) survive edits.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.digitalProductSalesPage.findMany({
      where: { productId },
      select: { id: true, pageSlug: true },
    });
    const idBySlug = new Map(existing.map((row) => [row.pageSlug, row.id]));
    await tx.digitalProductSalesPage.deleteMany({
      where: { productId, pageSlug: { notIn: salesPages.map((row) => row.pageSlug) } },
    });
    for (const row of salesPages) {
      const id = idBySlug.get(row.pageSlug);
      if (id) {
        await tx.digitalProductSalesPage.update({ where: { id }, data: row });
      } else {
        await tx.digitalProductSalesPage.create({ data: { productId, ...row } });
      }
    }
  });
}

export async function createDigitalProduct(input: {
  name: string;
  category: string;
  shortDescription: string;
  productType: string;
  niche?: string;
  status: string;
  featured?: boolean;
  isNew?: boolean;
  salesPageUrl?: string;
  affiliateTrackingParam?: string;
  lifetimeCookie?: boolean;
  isPrivate?: boolean;
  allowedPublisherIds?: string[];
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
  salesPages?: DigitalProductSalesPageInput[];
  cfProductId?: string | null;
  cfProductName?: string | null;
}) {
  const upsells = normalizeUpsellInputs(input.upsells);
  const salesPages = normalizeSalesPageInputs(
    input.salesPages,
    input.salesPageUrl,
    upsells.map((u) => u.pageSlug),
  );
  const frontEndCf = {
    cfProductId: normalizeCfProductId(input.cfProductId),
    cfProductName: normalizeCfProductName(input.cfProductName),
  };
  await assertCfMappingsAvailable(null, frontEndCf.cfProductId, upsells);
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
      niche: input.niche ?? "",
      status: toInputStatus(input.status),
      featured: input.featured ?? false,
      isNew: input.isNew ?? false,
      salesPageUrl: input.salesPageUrl,
      affiliateTrackingParam: input.affiliateTrackingParam,
      lifetimeCookie: input.lifetimeCookie ?? false,
      isPrivate: input.isPrivate ?? false,
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
      salesPages: salesPages.length > 0 ? { create: salesPages } : undefined,
    },
  });
  await syncProductCfMappings(row.id, frontEndCf, upsells);
  if (input.allowedPublisherIds) {
    await replaceProductAllowedPublishers(row.id, input.allowedPublisherIds);
  }
  return getDigitalProductById(row.id);
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
    lifetimeCookie: boolean;
    isPrivate: boolean;
    allowedPublisherIds: string[];
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
    salesPages: DigitalProductSalesPageInput[];
    cfProductId: string | null;
    cfProductName: string | null;
  }>,
) {
  const existing = await prisma.digitalProduct.findUnique({
    where: { id },
    include: {
      upsells: { select: { id: true, pageSlug: true } },
      cfMappings: CF_MAPPINGS_INCLUDE,
    },
  });
  if (!existing) throw Errors.notFound("Digital product");

  const hasUpsells = Object.prototype.hasOwnProperty.call(input, "upsells");
  const upsells = hasUpsells ? normalizeUpsellInputs(input.upsells) : null;
  const hasFrontEndCf = Object.prototype.hasOwnProperty.call(input, "cfProductId");
  const shouldSyncCf = hasFrontEndCf || hasUpsells;
  const existingFrontEndCf = existing.cfMappings.find((m) => !m.upsellId);
  const frontEndCf = hasFrontEndCf
    ? {
        cfProductId: normalizeCfProductId(input.cfProductId),
        cfProductName: normalizeCfProductName(input.cfProductName),
      }
    : {
        cfProductId: existingFrontEndCf?.cfProductId ?? null,
        cfProductName: existingFrontEndCf?.cfProductName ?? null,
      };
  // Keep existing upsell mappings when only the front end changes.
  const upsellsForCf: NormalizedUpsellInput[] =
    upsells ??
    existing.upsells.map((u, index) => {
      const mapping = existing.cfMappings.find((m) => m.upsellId === u.id);
      return {
        name: "",
        pageUrl: "",
        pageSlug: u.pageSlug,
        price: 0,
        commissionPct: 0,
        sortOrder: index,
        cfProductId: mapping?.cfProductId ?? null,
        cfProductName: mapping?.cfProductName ?? null,
      };
    });
  if (shouldSyncCf) await assertCfMappingsAvailable(id, frontEndCf.cfProductId, upsellsForCf);
  const salesPages = Object.prototype.hasOwnProperty.call(input, "salesPages")
    ? normalizeSalesPageInputs(
        input.salesPages,
        input.salesPageUrl ?? existing.salesPageUrl,
        (upsells ?? existing.upsells).map((u) => u.pageSlug),
      )
    : null;

  let categoryId = existing.categoryId;
  if (input.category) {
    const category = await prisma.digitalProductCategory.upsert({
      where: { name: input.category },
      create: { name: input.category, status: "ACTIVE" },
      update: {},
    });
    categoryId = category.id;
  }

  if (upsells) await replaceProductUpsells(id, upsells);
  if (salesPages) await replaceProductSalesPages(id, salesPages);

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
      lifetimeCookie: input.lifetimeCookie,
      isPrivate: input.isPrivate,
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
  });
  if (shouldSyncCf) await syncProductCfMappings(row.id, frontEndCf, upsellsForCf);
  if (Array.isArray(input.allowedPublisherIds)) {
    await replaceProductAllowedPublishers(row.id, input.allowedPublisherIds);
  }
  return getDigitalProductById(row.id);
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

export type DigitalProductConversionStatus = "approved" | "rejected";

const WEBHOOK_TRACKING_SELECT = { subId: true, subId2: true, subId3: true, subId4: true, src: true } as const;

type WebhookTrackingColumns = {
  subId: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  src: string | null;
};

/** Stored attribution wins; the CF payload only fills gaps on older events. */
function webhookTrackingValues(
  row: WebhookTrackingColumns,
  fields: { subId: string | null; source: string | null },
) {
  return {
    source: row.src?.trim() || fields.source,
    subId: row.subId?.trim() || fields.subId,
    subId2: row.subId2?.trim() || null,
    subId3: row.subId3?.trim() || null,
    subId4: row.subId4?.trim() || null,
  };
}

type SubIdFilters = { subId?: string; subId2?: string; subId3?: string; subId4?: string };

function normalizeSubIdFilters(input: SubIdFilters): SubIdFilters | null {
  const subId = input.subId?.trim() || undefined;
  const subId2 = input.subId2?.trim() || undefined;
  const subId3 = input.subId3?.trim() || undefined;
  const subId4 = input.subId4?.trim() || undefined;
  return subId || subId2 || subId3 || subId4 ? { subId, subId2, subId3, subId4 } : null;
}

function matchesSubIdFilters(
  row: { subId: string | null; subId2: string | null; subId3: string | null; subId4: string | null },
  filters: SubIdFilters,
) {
  return (
    (!filters.subId || row.subId === filters.subId) &&
    (!filters.subId2 || row.subId2 === filters.subId2) &&
    (!filters.subId3 || row.subId3 === filters.subId3) &&
    (!filters.subId4 || row.subId4 === filters.subId4)
  );
}

export function parseDigitalProductConversionStatus(
  raw: string | null | undefined,
): DigitalProductConversionStatus {
  return raw === "rejected" ? "rejected" : "approved";
}

/** Report Log status: conversion statuses plus refunded orders. */
export type DigitalProductOrderStatus = DigitalProductConversionStatus | "refunded";

export function parseDigitalProductOrderStatus(
  raw: string | null | undefined,
): DigitalProductOrderStatus {
  return raw === "refunded" ? "refunded" : parseDigitalProductConversionStatus(raw);
}

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
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  eventType: string;
  webhookStatus: string;
  paymentStatus: string | null;
  /** Ingest idempotency key; dedupe uses it before order id. */
  dedupeKey?: string | null;
  isRecurring?: boolean;
  cfProductId?: string | null;
  cfOrderId?: string | null;
  cfSubscriptionId?: string | null;
  clickId?: string | null;
  /** Rejection / duplicate reason for non-PROCESSED events. */
  reason?: string | null;
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
    const key = row.dedupeKey || row.orderId?.trim() || row.id;
    const existing = best.get(key);
    if (!existing || preferOrderRow(row, existing)) {
      best.set(key, row);
    }
  }
  return [...best.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export type DigitalProductWebhookEventForDedupe = {
  id: string;
  publisherId: string | null;
  eventType: string;
  payloadJson: unknown;
  subId?: string | null;
  src?: string | null;
  createdAt: Date;
  status?: string | null;
  externalEventKey?: string | null;
};

/** Prefer PROCESSED + attributed + tracking params + newest when collapsing CF retries. */
function preferWebhookEventForOrderIdDedupe(
  a: DigitalProductWebhookEventForDedupe,
  b: DigitalProductWebhookEventForDedupe,
): boolean {
  const aProcessed = a.status === "PROCESSED" ? 1 : 0;
  const bProcessed = b.status === "PROCESSED" ? 1 : 0;
  if (aProcessed !== bProcessed) return aProcessed > bProcessed;
  const aPub = a.publisherId ? 1 : 0;
  const bPub = b.publisherId ? 1 : 0;
  if (aPub !== bPub) return aPub > bPub;
  const aTrack = a.subId || a.src ? 1 : 0;
  const bTrack = b.subId || b.src ? 1 : 0;
  if (aTrack !== bTrack) return aTrack > bTrack;
  return a.createdAt.getTime() > b.createdAt.getTime();
}

/**
 * Collapse duplicate ClickFunnels webhook deliveries by orderId so affiliate
 * conversions / revenue match Report Log unique-order counts.
 */
export function dedupeDigitalProductWebhookEventsByOrderId<
  T extends DigitalProductWebhookEventForDedupe,
>(events: T[]): T[] {
  const best = new Map<string, T>();
  for (const [idx, ev] of events.entries()) {
    const fields = extractOrderFields(ev.payloadJson);
    const key = ev.externalEventKey || fields.orderId?.trim() || ev.id || `idx-${idx}`;
    const existing = best.get(key);
    if (!existing || preferWebhookEventForOrderIdDedupe(ev, existing)) {
      best.set(key, ev);
    }
  }
  return [...best.values()];
}

/** Shown instead of PROCESSED on a sale whose order was later refunded. */
export const REFUNDED_WEBHOOK_STATUS = "REFUNDED";

const REFUND_MATCH_SELECT = {
  publisherId: true,
  digitalProductId: true,
  cfOrderId: true,
  cfProductId: true,
} as const;

type RefundMatchRow = {
  publisherId: string | null;
  digitalProductId?: string | null;
  cfOrderId?: string | null;
  cfProductId?: string | null;
};

export function isRefundWebhookEvent(row: {
  eventType: string;
  externalEventKey?: string | null;
}): boolean {
  return (
    (row.externalEventKey ?? "").startsWith("cf:refund:") || /refund|chargeback/i.test(row.eventType)
  );
}

export function refundMatchKey(row: RefundMatchRow): string | null {
  if (!row.publisherId || !row.digitalProductId || !row.cfOrderId) return null;
  return [row.publisherId, row.digitalProductId, row.cfOrderId, row.cfProductId ?? ""].join("|");
}

/** Keys (see refundMatchKey) of orders that have a processed refund. */
export async function loadRefundedSaleKeys(publisherId?: string): Promise<Set<string>> {
  const refunds = await prisma.webhookEvent.findMany({
    where: {
      status: "PROCESSED",
      publisherId: publisherId ?? { not: null },
      OR: [
        { externalEventKey: { startsWith: "cf:refund:" } },
        { eventType: { contains: "refund" } },
        { eventType: { contains: "chargeback" } },
      ],
    },
    select: REFUND_MATCH_SELECT,
  });
  const keys = new Set<string>();
  for (const row of refunds) {
    const key = refundMatchKey(row);
    if (key) keys.add(key);
  }
  return keys;
}

export function isRefundedSale(
  row: RefundMatchRow & { eventType: string; externalEventKey?: string | null },
  refundedKeys: Set<string>,
): boolean {
  if (isRefundWebhookEvent(row)) return false;
  const key = refundMatchKey(row);
  return key != null && refundedKeys.has(key);
}

type SummaryOrderRow = DigitalCommissionSnapshot &
  RefundMatchRow & {
    publisherId: string | null;
    eventType: string;
    payloadJson: unknown;
    externalEventKey?: string | null;
  };

function summarizeDigitalProductOrders(
  rows: Array<SummaryOrderRow & { orderId: string | null }>,
  commissionLookup: Awaited<ReturnType<typeof loadDigitalProductCommissionLookup>>,
  productNameById: Map<string, string>,
  refundedKeys: Set<string>,
): DigitalProductOrderSummary {
  // Collapse by order id so retries don't inflate revenue / affiliate sales.
  // Caller should pass newest-first; first attributed row wins, else first seen.
  const best = new Map<string, SummaryOrderRow>();
  for (const [idx, ev] of rows.entries()) {
    const fields = extractOrderFields(ev.payloadJson);
    const orderId = ev.externalEventKey || fields.orderId || `idx-${idx}`;
    const existing = best.get(orderId);
    if (!existing) {
      best.set(orderId, ev);
      continue;
    }
    if (!existing.publisherId && ev.publisherId) {
      best.set(orderId, ev);
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
      if (isRefundWebhookEvent(ev) || isRefundedSale(ev, refundedKeys)) continue;
      const resolved = applyDigitalCommissionSnapshot(
        resolveDigitalProductForEvent(commissionLookup, productNameById, ev, fields.pageSlug, amount),
        ev,
      );
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

const DIGITAL_ORDER_SORT_ACCESSORS: Record<string, (row: DigitalProductOrderRow) => string | number | null> = {
  date: (row) => row.date,
  orderId: (row) => row.orderId,
  customer: (row) => row.customerName ?? row.customerEmail,
  product: (row) => row.product,
  funnel: (row) => row.funnel,
  type: (row) => row.orderType,
  amount: (row) => row.amount,
  commission: (row) => row.commission,
  affiliate: (row) => row.affiliateName ?? row.affiliateEmail,
  source: (row) => row.source,
  subId: (row) => row.subId,
  subId2: (row) => row.subId2,
  subId3: (row) => row.subId3,
  subId4: (row) => row.subId4,
  status: (row) => row.webhookStatus,
};

export async function listDigitalProductOrders(opts: {
  from?: Date;
  to?: Date;
  publisherId?: string;
  subId?: string;
  subId2?: string;
  subId3?: string;
  subId4?: string;
  eventType?: string;
  page?: number;
  limit?: number;
  /**
   * approved = PROCESSED and not refunded; refunded = sales whose order was refunded
   * (plus the refund events unless hidden); rejected = admin-rejected or auto-rejected
   * affiliate sales. Omitted = approved and refunded together.
   */
  status?: DigitalProductOrderStatus;
  /** Leave out refund events; the refunded sale itself is shown as REFUNDED. */
  hideRefunds?: boolean;
  /** Extra row filter applied before paging (publisher search). */
  rowFilter?: (row: DigitalProductOrderRow) => boolean;
  sortBy?: string;
  sortDir?: SortDir;
} = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 15));
  const skip = (page - 1) * limit;
  const subIdFilters = normalizeSubIdFilters(opts);

  const filterWhere: Prisma.WebhookEventWhereInput = {};
  if (opts.from || opts.to) {
    filterWhere.createdAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.eventType) filterWhere.eventType = { contains: opts.eventType };

  const approvedWhere: Prisma.WebhookEventWhereInput = {
    ...filterWhere,
    status: "PROCESSED",
    publisherId: opts.publisherId ?? { not: null },
  };
  const where: Prisma.WebhookEventWhereInput =
    opts.status === "rejected"
      ? {
          ...filterWhere,
          ...(opts.publisherId ? { publisherId: opts.publisherId } : {}),
          OR: [
            { status: "REJECTED" },
            {
              status: "IGNORED",
              OR: [{ publisherId: { not: null } }, { affiliateRef: { not: null } }],
            },
          ],
        }
      : approvedWhere;

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
    errorMessage: true,
    isRecurring: true,
    cfProductId: true,
    cfOrderId: true,
    cfSubscriptionId: true,
    clickId: true,
    ...WEBHOOK_TRACKING_SELECT,
    ...DIGITAL_COMMISSION_SNAPSHOT_SELECT,
  } as const;

  const [commissionLookup, productNameById, refundedKeys] = await Promise.all([
    loadDigitalProductCommissionLookup(),
    loadDigitalProductNameMap(),
    loadRefundedSaleKeys(opts.publisherId),
  ]);

  const mapRow = (
    row: DigitalCommissionSnapshot & {
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
      errorMessage: string | null;
      isRecurring: boolean;
      cfProductId: string | null;
      cfOrderId: string | null;
      cfSubscriptionId: string | null;
      clickId: string | null;
      externalEventKey?: string | null;
    } & WebhookTrackingColumns,
  ): DigitalProductOrderRow => {
    const fields = extractOrderFields(row.payloadJson);
    const leadFallback = extractLeadFromClickFunnelsPayload(row.payloadJson);
    const amount = fields.amount;
    const resolved = applyDigitalCommissionSnapshot(
      resolveDigitalProductForEvent(commissionLookup, productNameById, row, fields.pageSlug, amount),
      row,
    );
    const isRefund = isRefundWebhookEvent(row);
    const refunded = row.status === "PROCESSED" && isRefundedSale(row, refundedKeys);
    const commission =
      amount == null || !row.publisherId ? null : isRefund || refunded ? 0 : resolved.commission;
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
      ...webhookTrackingValues(row, fields),
      eventType: row.eventType,
      webhookStatus: refunded ? REFUNDED_WEBHOOK_STATUS : row.status,
      paymentStatus: fields.paymentStatus,
      dedupeKey: row.externalEventKey ?? null,
      isRecurring: row.isRecurring,
      cfProductId: row.cfProductId,
      cfOrderId: row.cfOrderId,
      cfSubscriptionId: row.cfSubscriptionId,
      clickId: row.clickId,
      reason: row.status === "PROCESSED" ? null : row.errorMessage,
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
      where: approvedWhere,
      select: {
        eventType: true,
        payloadJson: true,
        ...WEBHOOK_TRACKING_SELECT,
        ...DIGITAL_COMMISSION_SNAPSHOT_SELECT,
        ...REFUND_MATCH_SELECT,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
  ]);

  const isRefundRow = (row: DigitalProductOrderRow) =>
    isRefundWebhookEvent({ eventType: row.eventType, externalEventKey: row.dedupeKey });
  let mapped = allRows.map(mapRow);
  if (opts.hideRefunds) {
    mapped = mapped.filter((row) => !isRefundRow(row));
  }
  if (opts.status === "approved") {
    mapped = mapped.filter(
      (row) => row.webhookStatus !== REFUNDED_WEBHOOK_STATUS && !isRefundRow(row),
    );
  } else if (opts.status === "refunded") {
    mapped = mapped.filter(
      (row) => row.webhookStatus === REFUNDED_WEBHOOK_STATUS || isRefundRow(row),
    );
  }
  if (subIdFilters) {
    mapped = mapped.filter((row) => matchesSubIdFilters(row, subIdFilters));
  }
  if (opts.rowFilter) mapped = mapped.filter(opts.rowFilter);
  const dedupedItems = sortRows(dedupeDigitalProductOrderRows(mapped), opts, DIGITAL_ORDER_SORT_ACCESSORS);

  const summarySource = subIdFilters
    ? allForSummary.filter((ev) =>
        matchesSubIdFilters(
          webhookTrackingValues(ev, extractOrderFields(ev.payloadJson)),
          subIdFilters,
        ),
      )
    : allForSummary;
  const summary = summarizeDigitalProductOrders(
    summarySource.map((ev) => ({
      ...ev,
      orderId: extractOrderFields(ev.payloadJson).orderId,
    })),
    commissionLookup,
    productNameById,
    refundedKeys,
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
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
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
  orders: number;
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
  if (status === "refunded") {
    return (
      webhook === REFUNDED_WEBHOOK_STATUS || row.orderType === "Refund" || payment.includes("refund")
    );
  }
  return true;
}

export type WebhookEventCommission = {
  publisherId: string;
  /** Always positive; for a refund this is the commission to take back. */
  commission: number;
  isRefund: boolean;
};

/**
 * Commission earned (or reversed) by one processed marketplace sale, worked out
 * the same way as the publisher commission report so invoices match it.
 */
export async function resolveWebhookEventCommissions(
  eventIds: string[],
): Promise<Map<string, WebhookEventCommission | null>> {
  const result = new Map<string, WebhookEventCommission | null>();
  if (eventIds.length === 0) return result;

  const rows = await prisma.webhookEvent.findMany({
    where: { id: { in: eventIds } },
    select: {
      id: true,
      eventType: true,
      status: true,
      publisherId: true,
      payloadJson: true,
      ...DIGITAL_COMMISSION_SNAPSHOT_SELECT,
    },
  });

  const [commissionLookup, productNameById] = await Promise.all([
    loadDigitalProductCommissionLookup(),
    loadDigitalProductNameMap(),
  ]);

  for (const row of rows) {
    if (row.status !== "PROCESSED" || !row.publisherId) {
      result.set(row.id, null);
      continue;
    }

    const fields = extractOrderFields(row.payloadJson);
    const amount = fields.amount != null ? Math.abs(fields.amount) : null;
    if (amount == null) {
      result.set(row.id, null);
      continue;
    }

    const resolved = applyDigitalCommissionSnapshot(
      resolveDigitalProductForEvent(commissionLookup, productNameById, row, fields.pageSlug, amount),
      row,
    );
    const orderType =
      resolved.orderType ??
      classifyCommissionType(fields.orderType ?? row.eventType, row.eventType);
    const isRefund =
      orderType === "Refund" || (row.externalEventKey ?? "").startsWith("cf:refund:");
    const commission = Math.round(Math.abs(resolved.commission ?? 0) * 10_000) / 10_000;

    result.set(
      row.id,
      Number.isFinite(commission) && commission > 0
        ? { publisherId: row.publisherId, commission, isRefund }
        : null,
    );
  }

  return result;
}

const COMMISSION_SORT_ACCESSORS: Record<string, (row: PublisherCommissionRow) => string | number | null> = {
  date: (row) => row.date,
  orderId: (row) => row.orderId,
  product: (row) => row.product,
  funnel: (row) => row.funnel,
  type: (row) => row.orderType,
  amount: (row) => row.amount,
  commission: (row) => row.commission,
  rate: (row) => row.rate,
  source: (row) => row.source,
  subId: (row) => row.subId,
  subId2: (row) => row.subId2,
  subId3: (row) => row.subId3,
  subId4: (row) => row.subId4,
  status: (row) => row.webhookStatus,
  payment: (row) => row.paymentStatus,
};

export async function getPublisherCommissionReport(opts: {
  publisherId: string;
  from?: Date;
  to?: Date;
  product?: string;
  orderType?: string;
  source?: string;
  subId?: string;
  subId2?: string;
  subId3?: string;
  subId4?: string;
  status?: string;
  q?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: SortDir;
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
      ...WEBHOOK_TRACKING_SELECT,
      ...DIGITAL_COMMISSION_SNAPSHOT_SELECT,
      ...REFUND_MATCH_SELECT,
    },
  });

  const [commissionLookup, productNameById, refundedKeys] = await Promise.all([
    loadDigitalProductCommissionLookup(),
    loadDigitalProductNameMap(),
    loadRefundedSaleKeys(opts.publisherId),
  ]);

  const mapped: PublisherCommissionRow[] = events.map((row) => {
    const fields = extractOrderFields(row.payloadJson);
    const resolved = applyDigitalCommissionSnapshot(
      resolveDigitalProductForEvent(
        commissionLookup,
        productNameById,
        row,
        fields.pageSlug,
        fields.amount,
      ),
      row,
    );
    const isRefund = isRefundWebhookEvent(row);
    const orderType: PublisherCommissionType = isRefund
      ? "Refund"
      : (resolved.orderType ??
        classifyCommissionType(fields.orderType ?? row.eventType, row.eventType));
    const amount = fields.amount;
    const refunded = row.status === "PROCESSED" && isRefundedSale(row, refundedKeys);
    return {
      id: row.id,
      orderId: fields.orderId ?? `CF-${row.id.slice(-6).toUpperCase()}`,
      date: row.createdAt.toISOString(),
      product: resolved.productName ?? fields.product,
      funnel: fields.funnel,
      orderType,
      amount,
      commission:
        isRefund || refunded
          ? 0
          : amount != null
            ? resolved.commission
            : null,
      rate: isRefund ? 0 : resolved.rate,
      ...webhookTrackingValues(row, fields),
      webhookStatus: refunded ? REFUNDED_WEBHOOK_STATUS : row.status,
      paymentStatus: fields.paymentStatus,
    };
  });

  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
  const products = distinct(mapped.map((r) => r.product));
  const sources = distinct(mapped.map((r) => r.source));
  const subIds = distinct(mapped.map((r) => r.subId));
  const subIds2 = distinct(mapped.map((r) => r.subId2));
  const subIds3 = distinct(mapped.map((r) => r.subId3));
  const subIds4 = distinct(mapped.map((r) => r.subId4));

  const q = opts.q?.trim().toLowerCase();
  const filtered = mapped.filter((row) => {
    if (opts.product && opts.product !== "all" && row.product !== opts.product) return false;
    if (opts.source && opts.source !== "all" && row.source !== opts.source) return false;
    if (opts.subId && opts.subId !== "all" && row.subId !== opts.subId) return false;
    if (opts.subId2 && opts.subId2 !== "all" && row.subId2 !== opts.subId2) return false;
    if (opts.subId3 && opts.subId3 !== "all" && row.subId3 !== opts.subId3) return false;
    if (opts.subId4 && opts.subId4 !== "all" && row.subId4 !== opts.subId4) return false;
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

  const byDay = new Map<string, { sales: number; commission: number; orders: number }>();
  const byType = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const productStatsMap = new Map<string, { orders: number; commission: number }>();

  for (const row of filtered) {
    const amount = row.amount ?? 0;
    const commission = row.commission ?? 0;
    const day = dayKey(row.date);
    const bucket = byDay.get(day) ?? { sales: 0, commission: 0, orders: 0 };

    if (row.orderType === "Refund") {
      kpis.refunds += amount;
    } else {
      kpis.orders += 1;
      kpis.sales += amount;
      kpis.commission += commission;
      bucket.sales += amount;
      bucket.commission += commission;
      bucket.orders += 1;
      byType.set(row.orderType, (byType.get(row.orderType) ?? 0) + commission);
      if (row.product) {
        byProduct.set(row.product, (byProduct.get(row.product) ?? 0) + commission);
        const stats = productStatsMap.get(row.product) ?? { orders: 0, commission: 0 };
        stats.orders += 1;
        stats.commission += commission;
        productStatsMap.set(row.product, stats);
      }
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
    const bucket = byDay.get(key) ?? { sales: 0, commission: 0, orders: 0 };
    series.push({
      date: key,
      label: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      sales: bucket.sales,
      commission: bucket.commission,
      orders: bucket.orders,
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

  // Refund events only feed the refunds KPI; the table shows the sale as REFUNDED.
  const tableRows = sortRows(
    filtered.filter((row) => row.orderType !== "Refund"),
    opts,
    COMMISSION_SORT_ACCESSORS,
  );
  const total = tableRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(page, totalPages);
  const items = tableRows.slice((safePage - 1) * limit, safePage * limit);

  const productStats = [...productStatsMap.entries()].map(([name, stats]) => ({ name, ...stats }));

  return {
    kpis,
    series,
    typeSlices,
    productSlices,
    productStats,
    items,
    total,
    page: safePage,
    limit,
    totalPages,
    filterOptions: { products, sources, subIds, subIds2, subIds3, subIds4 },
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
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
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
  subId2?: string;
  subId3?: string;
  subId4?: string;
  src?: string;
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  /** Conversions counted in the affiliate report (default approved). */
  status?: DigitalProductConversionStatus;
  sortBy?: string;
  sortDir?: SortDir;
};

type DigitalClickOrderBy = Prisma.DigitalProductClickOrderByWithRelationInput;

const DIGITAL_CLICK_SORT_COLUMNS: Record<string, (dir: SortDir) => DigitalClickOrderBy> = {
  date: (dir) => ({ createdAt: dir }),
  clickId: (dir) => ({ id: dir }),
  product: (dir) => ({ product: { name: dir } }),
  affiliate: (dir) => ({ publisher: { name: dir } }),
  source: (dir) => ({ src: dir }),
  subId: (dir) => ({ subId: dir }),
  subId2: (dir) => ({ subId2: dir }),
  subId3: (dir) => ({ subId3: dir }),
  subId4: (dir) => ({ subId4: dir }),
  campaign: (dir) => ({ campaign: dir }),
  ip: (dir) => ({ ip: dir }),
};

function digitalClickOrderBy(filters: DigitalProductClickListFilters): DigitalClickOrderBy[] {
  return buildReportOrderBy<DigitalClickOrderBy>(
    filters,
    DIGITAL_CLICK_SORT_COLUMNS,
    { createdAt: "desc" },
    (dir) => ({ id: dir }),
  );
}

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
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
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
    subId2: row.subId2,
    subId3: row.subId3,
    subId4: row.subId4,
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

  const subIds = normalizeSubIdFilters(filters);
  if (subIds?.subId) where.subId = subIds.subId;
  if (subIds?.subId2) where.subId2 = subIds.subId2;
  if (subIds?.subId3) where.subId3 = subIds.subId3;
  if (subIds?.subId4) where.subId4 = subIds.subId4;

  const src = filters.src?.trim();
  if (src) where.src = src;

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
      { subId2: { contains: q } },
      { subId3: { contains: q } },
      { subId4: { contains: q } },
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
      orderBy: digitalClickOrderBy(filters),
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
      orderBy: digitalClickOrderBy(filters),
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
    subId2?: string;
    subId3?: string;
    subId4?: string;
    eventType?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    /** Omitted or "all" lists approved and refunded orders together. */
    status?: "all" | "approved" | "refunded";
    sortBy?: string;
    sortDir?: SortDir;
  } = {},
) {
  const from = opts.from ? new Date(opts.from) : undefined;
  const to = opts.to ? new Date(opts.to) : undefined;
  const q = opts.q?.trim().toLowerCase();
  const productId = opts.productId?.trim().toLowerCase();
  const rowFilter =
    q || productId
      ? (row: DigitalProductOrderRow) => {
          if (productId && !`${row.product ?? ""}`.toLowerCase().includes(productId)) return false;
          if (q) {
            const hay = `${row.orderId} ${row.product ?? ""} ${row.funnel ?? ""} ${row.source ?? ""} ${row.subId ?? ""} ${row.subId2 ?? ""} ${row.subId3 ?? ""} ${row.subId4 ?? ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }
      : undefined;
  return listDigitalProductOrders({
    publisherId,
    status: opts.status === "all" ? undefined : opts.status,
    subId: opts.subId,
    subId2: opts.subId2,
    subId3: opts.subId3,
    subId4: opts.subId4,
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
    eventType: opts.eventType,
    page: opts.page,
    limit: opts.limit ?? 20,
    hideRefunds: true,
    rowFilter,
    sortBy: opts.sortBy,
    sortDir: opts.sortDir,
  });
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

/** Affiliate report join key: publisher + product + Sub ID 1/2/3 (source is display-only). */
export function digitalProductAffiliateReportKeyOf(
  publisherId: string,
  productId: string | null,
  nameKey: string,
  subId: string | null,
  subId2: string | null = null,
  subId3: string | null = null,
  subId4: string | null = null,
) {
  const productPart = productId
    ? `id::${productId}`
    : `name::${nameKey || "_"}`;
  const extra =
    subId2 || subId3 || subId4
      ? `::${subId2 ?? ""}::${subId3 ?? ""}${subId4 ? `::${subId4}` : ""}`
      : "";
  return `${publisherId}::${productPart}::${subId ?? ""}${extra}`;
}

/**
 * Prefer stored click attribution, then a historical click match, then CF payload.
 * Avoids CF channel/product names splitting click vs conversion rows.
 * Sub ID 2/3 come from the same tier as Sub ID 1 so one visit's values stay together.
 */
export function resolveDigitalProductOrderTrackingParams(input: {
  storedSubId?: string | null;
  storedSubId2?: string | null;
  storedSubId3?: string | null;
  storedSubId4?: string | null;
  storedSrc?: string | null;
  clickSubId?: string | null;
  clickSubId2?: string | null;
  clickSubId3?: string | null;
  clickSubId4?: string | null;
  clickSrc?: string | null;
  payloadSubId?: string | null;
  payloadSrc?: string | null;
}): { subId: string | null; subId2: string | null; subId3: string | null; subId4: string | null; source: string | null } {
  const stored = input.storedSubId ?? input.storedSubId2 ?? input.storedSubId3 ?? input.storedSubId4;
  const click = input.clickSubId ?? input.clickSubId2 ?? input.clickSubId3 ?? input.clickSubId4;
  const subs = stored
    ? {
        subId: input.storedSubId ?? null,
        subId2: input.storedSubId2 ?? null,
        subId3: input.storedSubId3 ?? null,
        subId4: input.storedSubId4 ?? null,
      }
    : click
      ? {
          subId: input.clickSubId ?? null,
          subId2: input.clickSubId2 ?? null,
          subId3: input.clickSubId3 ?? null,
          subId4: input.clickSubId4 ?? null,
        }
      : { subId: input.payloadSubId ?? null, subId2: null, subId3: null, subId4: null };
  const source =
    (input.storedSrc?.trim() || null) ??
    (input.clickSrc?.trim() || null) ??
    (input.payloadSrc?.trim() || null);
  return { ...subs, source };
}

export type DigitalProductClickTrackingRow = {
  id: string;
  publisherId: string;
  productId: string;
  subId: string | null;
  subId2?: string | null;
  subId3?: string | null;
  subId4?: string | null;
  src: string | null;
  createdAt: Date;
};

/** Latest in-window click for publisher + product (clicks must be newest-first). */
export function pickDigitalProductClickForAttribution(
  clicks: DigitalProductClickTrackingRow[],
  publisherId: string,
  productId: string | null,
  at: Date,
  windowMs: number,
): DigitalProductClickTrackingRow | null {
  if (!productId) return null;
  const windowStart = at.getTime() - windowMs;
  const atMs = at.getTime();
  for (const click of clicks) {
    if (click.publisherId !== publisherId || click.productId !== productId) {
      continue;
    }
    const t = click.createdAt.getTime();
    if (t > atMs || t < windowStart) continue;
    return click;
  }
  return null;
}

export type SerializedDigitalProductAffiliateReportRow = {
  publisherId: string;
  publisherName: string;
  productId: string | null;
  productName: string;
  subId: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  source: string | null;
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
    status: filters.status === "rejected" ? { in: ["REJECTED", "IGNORED"] } : "PROCESSED",
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
  const refundedKeys = await loadRefundedSaleKeys(publisherId || undefined);
  const productById = new Map(catalogProducts.map((p) => [p.id, p]));
  const productNameById = new Map(catalogProducts.map((p) => [p.id, p.name]));
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
  const subIdFilters = normalizeSubIdFilters(filters);
  const filterSrc = filters.src?.trim() || undefined;

  const q = filters.q?.trim().toLowerCase();

  const [clickGroups, orderEvents, attributionClicks] = await Promise.all([
    prisma.digitalProductClick.groupBy({
      by: ["publisherId", "productId", "subId", "subId2", "subId3", "subId4", "src"],
      where: clickWhere,
      _count: { _all: true },
    }),
    prisma.webhookEvent.findMany({
      where: webhookWhere,
      select: {
        id: true,
        status: true,
        publisherId: true,
        eventType: true,
        payloadJson: true,
        ...WEBHOOK_TRACKING_SELECT,
        createdAt: true,
        ...DIGITAL_COMMISSION_SNAPSHOT_SELECT,
        cfOrderId: true,
        cfProductId: true,
      },
      take: 10000,
    }),
    prisma.digitalProductClick.findMany({
      where: clickWhere,
      select: {
        id: true,
        publisherId: true,
        productId: true,
        subId: true,
        subId2: true,
        subId3: true,
        subId4: true,
        src: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20000,
    }),
  ]);

  // CF retries create multiple PROCESSED rows per purchase — align with Report Log.
  const dedupedOrderEvents = dedupeDigitalProductWebhookEventsByOrderId(orderEvents);

  type Acc = {
    publisherId: string;
    productId: string | null;
    productName: string;
    nameKey: string;
    subId: string | null;
    subId2: string | null;
    subId3: string | null;
    subId4: string | null;
    source: string | null;
    clicks: number;
    conversions: number;
    commission: number;
    revenue: number;
  };

  const byKey = new Map<string, Acc>();
  const keyOf = digitalProductAffiliateReportKeyOf;

  for (const g of clickGroups) {
    const product = productById.get(g.productId);
    const productName = product?.name ?? g.productId;
    const nameKey = normalizeProductNameKey(productName);
    const source = g.src?.trim() || null;
    const key = keyOf(g.publisherId, g.productId, nameKey, g.subId, g.subId2, g.subId3, g.subId4);
    const existing = byKey.get(key);
    if (existing) {
      existing.clicks += g._count._all;
      if (!existing.source && source) existing.source = source;
      continue;
    }
    byKey.set(key, {
      publisherId: g.publisherId,
      productId: g.productId,
      productName,
      nameKey,
      subId: g.subId,
      subId2: g.subId2,
      subId3: g.subId3,
      subId4: g.subId4,
      source,
      clicks: g._count._all,
      conversions: 0,
      commission: 0,
      revenue: 0,
    });
  }

  for (const ev of dedupedOrderEvents) {
    if (!ev.publisherId) continue;
    const fields = extractOrderFields(ev.payloadJson);
    const type = (fields.orderType ?? ev.eventType ?? "").toLowerCase();
    if (type.includes("refund") || isRefundWebhookEvent(ev)) continue;
    if (ev.status === "PROCESSED" && isRefundedSale(ev, refundedKeys)) continue;

    const amount = fields.amount ?? 0;
    const resolved = applyDigitalCommissionSnapshot(
      resolveDigitalProductForEvent(commissionLookup, productNameById, ev, fields.pageSlug, amount),
      ev,
    );
    const productName =
      (resolved.productName ?? fields.product?.trim()) || "Unknown product";
    const nameKey = normalizeProductNameKey(productName);
    const matchedProductId =
      resolved.productId ??
      (nameKey ? productIdByName.get(nameKey) ?? null : null);

    const historicalClick = pickDigitalProductClickForAttribution(
      attributionClicks,
      ev.publisherId,
      matchedProductId,
      ev.createdAt,
      DIGITAL_PRODUCT_CLICK_ATTRIBUTION_WINDOW_MS,
    );
    const orderTracking = resolveDigitalProductOrderTrackingParams({
      storedSubId: ev.subId,
      storedSubId2: ev.subId2,
      storedSubId3: ev.subId3,
      storedSubId4: ev.subId4,
      storedSrc: ev.src,
      clickSubId: historicalClick?.subId,
      clickSubId2: historicalClick?.subId2,
      clickSubId3: historicalClick?.subId3,
      clickSubId4: historicalClick?.subId4,
      clickSrc: historicalClick?.src,
      payloadSubId: fields.subId,
      payloadSrc: fields.source,
    });
    const { subId: orderSubId, subId2: orderSubId2, subId3: orderSubId3, subId4: orderSubId4, source: orderSource } =
      orderTracking;

    if (subIdFilters && !matchesSubIdFilters(orderTracking, subIdFilters)) continue;
    if (filterSrc && orderSource !== filterSrc) continue;

    if (filterProductId) {
      if (matchedProductId) {
        if (matchedProductId !== filterProductId) continue;
      } else if (!filterProductNameKey || nameKey !== filterProductNameKey) {
        if (!nameKey.includes(filterProductId.toLowerCase())) continue;
      }
    }

    if (q) {
      const hay = `${productName} ${matchedProductId ?? ""} ${ev.publisherId} ${orderSubId ?? ""} ${orderSubId2 ?? ""} ${orderSubId3 ?? ""} ${orderSubId4 ?? ""} ${orderSource ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const key = keyOf(ev.publisherId, matchedProductId, nameKey, orderSubId, orderSubId2, orderSubId3, orderSubId4);
    const acc = byKey.get(key) ?? {
      publisherId: ev.publisherId,
      productId: matchedProductId,
      productName: matchedProductId
        ? productById.get(matchedProductId)?.name ?? productName
        : productName,
      nameKey,
      subId: orderSubId,
      subId2: orderSubId2,
      subId3: orderSubId3,
      subId4: orderSubId4,
      source: orderSource,
      clicks: 0,
      conversions: 0,
      commission: 0,
      revenue: 0,
    };

    if (!acc.source && orderSource) acc.source = orderSource;
    if (acc.subId == null && orderSubId != null) acc.subId = orderSubId;

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
      const hay = `${acc.productName} ${acc.productId ?? ""} ${acc.publisherId} ${acc.subId ?? ""} ${acc.subId2 ?? ""} ${acc.subId3 ?? ""} ${acc.subId4 ?? ""} ${acc.source ?? ""}`.toLowerCase();
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
        subId2: acc.subId2,
        subId3: acc.subId3,
        subId4: acc.subId4,
        source: acc.source,
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
      const bySub =
        (a.subId ?? "").localeCompare(b.subId ?? "") ||
        (a.subId2 ?? "").localeCompare(b.subId2 ?? "") ||
        (a.subId3 ?? "").localeCompare(b.subId3 ?? "") ||
        (a.subId4 ?? "").localeCompare(b.subId4 ?? "");
      if (bySub !== 0) return bySub;
      return (a.source ?? "").localeCompare(b.source ?? "");
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
