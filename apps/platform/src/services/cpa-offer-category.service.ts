import type { CatalogCategoryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export type SerializedCpaOfferCategory = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  offerCount: number;
};

const DEFAULT_CPA_OFFER_CATEGORIES = [
  "Make Money",
  "Finance",
  "Insurance",
  "Health",
  "Dating",
  "E-commerce",
  "Software",
  "Gaming",
  "Education",
  "Nutra",
] as const;

function mapCategoryStatus(status: CatalogCategoryStatus): "Active" | "Inactive" {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

async function offerCountByName(name: string): Promise<number> {
  return prisma.cpaOffer.count({ where: { category: name } });
}

export async function ensureDefaultCpaOfferCategories() {
  const existingCount = await prisma.cpaOfferCategory.count();
  if (existingCount > 0) return;

  const fromOffers = await prisma.cpaOffer.findMany({
    distinct: ["category"],
    select: { category: true },
  });
  const names = new Set<string>();
  for (const name of DEFAULT_CPA_OFFER_CATEGORIES) names.add(name);
  for (const row of fromOffers) {
    const trimmed = row.category?.trim();
    if (trimmed) names.add(trimmed);
  }

  if (names.size === 0) return;

  await prisma.cpaOfferCategory.createMany({
    data: [...names].map((name) => ({ name, status: "ACTIVE" as const })),
    skipDuplicates: true,
  });
}

export async function listCpaOfferCategories(): Promise<SerializedCpaOfferCategory[]> {
  await ensureDefaultCpaOfferCategories();
  const rows = await prisma.cpaOfferCategory.findMany({
    orderBy: { name: "asc" },
  });
  const counts = await Promise.all(rows.map((row) => offerCountByName(row.name)));
  return rows.map((row, index) => ({
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    offerCount: counts[index] ?? 0,
  }));
}

export async function listActiveCpaOfferCategoryNames(): Promise<string[]> {
  await ensureDefaultCpaOfferCategories();
  const rows = await prisma.cpaOfferCategory.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return rows.map((row) => row.name);
}

export async function saveCpaOfferCategory(input: {
  id?: string;
  name: string;
  status: "Active" | "Inactive";
}): Promise<SerializedCpaOfferCategory> {
  const name = input.name.trim();
  if (name.length < 2) {
    throw Errors.validation("Category name must be at least 2 characters");
  }
  const status: CatalogCategoryStatus = input.status === "Active" ? "ACTIVE" : "INACTIVE";

  if (input.id) {
    const existing = await prisma.cpaOfferCategory.findUnique({ where: { id: input.id } });
    if (!existing) throw Errors.notFound("Category");

    const duplicate = await prisma.cpaOfferCategory.findFirst({
      where: {
        name: { equals: name },
        NOT: { id: input.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw Errors.validation("Category already exists");
    }

    const row = await prisma.$transaction(async (tx) => {
      if (existing.name !== name) {
        await tx.cpaOffer.updateMany({
          where: { category: existing.name },
          data: { category: name },
        });
      }
      return tx.cpaOfferCategory.update({
        where: { id: input.id },
        data: { name, status },
      });
    });

    return {
      id: row.id,
      name: row.name,
      status: mapCategoryStatus(row.status),
      offerCount: await offerCountByName(row.name),
    };
  }

  const duplicate = await prisma.cpaOfferCategory.findFirst({
    where: { name: { equals: name } },
    select: { id: true },
  });
  if (duplicate) {
    throw Errors.validation("Category already exists");
  }

  const row = await prisma.cpaOfferCategory.create({
    data: { name, status },
  });
  return {
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    offerCount: 0,
  };
}

export async function deleteCpaOfferCategory(id: string) {
  const existing = await prisma.cpaOfferCategory.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Category");

  const count = await offerCountByName(existing.name);
  if (count > 0) {
    throw Errors.validation("Category has offers and cannot be deleted");
  }

  await prisma.cpaOfferCategory.delete({ where: { id } });
  return { id };
}
