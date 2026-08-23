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
