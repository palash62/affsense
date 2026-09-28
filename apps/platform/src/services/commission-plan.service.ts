import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { AppError, Errors } from "@/lib/errors";
import {
  loadPublisherDigitalPlanRates,
  type DigitalCommissionPlanRates,
} from "@/lib/digital-product-commission";
import { normalizePageSlug } from "@/lib/digital-product-page-slug";
import type {
  CpaCommissionPlanInput,
  CpaCommissionPlanUpdateInput,
  DigitalCommissionPlanInput,
  DigitalCommissionPlanUpdateInput,
} from "@/lib/validations";

type Tx = Prisma.TransactionClient;

export type CommissionPlanMemberDto = {
  publisherId: string;
  name: string;
  email: string;
};

export type CpaCommissionPlanDto = {
  id: string;
  offerId: string;
  name: string;
  payout: number;
  isActive: boolean;
  members: CommissionPlanMemberDto[];
  createdAt: string;
  updatedAt: string;
};

export type DigitalCommissionPlanDto = {
  id: string;
  productId: string;
  name: string;
  frontEndCommission: number;
  isActive: boolean;
  upsellRates: { upsellId: string; pageSlug: string; commissionPct: number }[];
  members: CommissionPlanMemberDto[];
  createdAt: string;
  updatedAt: string;
};

const memberInclude = {
  orderBy: { createdAt: "asc" },
  include: { publisher: { select: { id: true, name: true, email: true } } },
} as const;

function serializeMembers(
  members: { publisher: { id: string; name: string; email: string } }[],
): CommissionPlanMemberDto[] {
  return members.map((m) => ({
    publisherId: m.publisher.id,
    name: m.publisher.name,
    email: m.publisher.email,
  }));
}

/**
 * Publishers already in a different plan for the same product.
 * An affiliate can belong to at most one plan per product.
 */
export function findCommissionPlanMemberConflicts(
  existing: { publisherId: string; planId: string }[],
  planId: string | null,
  publisherIds: string[],
): string[] {
  const takenElsewhere = new Set(
    existing.filter((row) => row.planId !== planId).map((row) => row.publisherId),
  );
  return [...new Set(publisherIds)].filter((id) => takenElsewhere.has(id));
}

async function assertPublishers(tx: Tx, publisherIds: string[]) {
  if (publisherIds.length === 0) return;
  const found = await tx.user.findMany({
    where: { id: { in: publisherIds }, role: "PUBLISHER" },
    select: { id: true },
  });
  if (found.length !== publisherIds.length) {
    throw Errors.validation("One or more selected affiliates are not valid publishers", "publisherIds");
  }
}

async function conflictError(tx: Tx, conflicts: string[]) {
  const users = await tx.user.findMany({
    where: { id: { in: conflicts } },
    select: { name: true, email: true },
  });
  const label = users.map((u) => u.name || u.email).join(", ");
  return new AppError(
    "COMMISSION_PLAN_MEMBER_CONFLICT",
    `Already in another commission plan for this product: ${label}`,
    409,
    "publisherIds",
  );
}

// ---------------------------------------------------------------------------
// CPA offer plans
// ---------------------------------------------------------------------------

const cpaPlanInclude = { members: memberInclude } as const;

type CpaPlanRow = Prisma.CpaOfferCommissionPlanGetPayload<{ include: typeof cpaPlanInclude }>;

function serializeCpaPlan(plan: CpaPlanRow): CpaCommissionPlanDto {
  return {
    id: plan.id,
    offerId: plan.offerId,
    name: plan.name,
    payout: Number(plan.payout),
    isActive: plan.isActive,
    members: serializeMembers(plan.members),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

async function assertCpaOffer(offerId: string) {
  const offer = await prisma.cpaOffer.findUnique({ where: { id: offerId }, select: { id: true } });
  if (!offer) throw Errors.notFound("CPA offer");
}

async function setCpaPlanMembers(tx: Tx, offerId: string, planId: string, publisherIds: string[]) {
  await assertPublishers(tx, publisherIds);
  const existing = await tx.cpaOfferCommissionPlanMember.findMany({
    where: { offerId, publisherId: { in: publisherIds } },
    select: { publisherId: true, planId: true },
  });
  const conflicts = findCommissionPlanMemberConflicts(existing, planId, publisherIds);
  if (conflicts.length > 0) throw await conflictError(tx, conflicts);

  await tx.cpaOfferCommissionPlanMember.deleteMany({
    where: { planId, publisherId: { notIn: publisherIds } },
  });
  const current = new Set(existing.filter((r) => r.planId === planId).map((r) => r.publisherId));
  const toAdd = publisherIds.filter((id) => !current.has(id));
  if (toAdd.length > 0) {
    await tx.cpaOfferCommissionPlanMember.createMany({
      data: toAdd.map((publisherId) => ({ planId, offerId, publisherId })),
    });
  }
}

export async function listCpaCommissionPlans(offerId: string): Promise<CpaCommissionPlanDto[]> {
  await assertCpaOffer(offerId);
  const plans = await prisma.cpaOfferCommissionPlan.findMany({
    where: { offerId },
    orderBy: { createdAt: "asc" },
    include: cpaPlanInclude,
  });
  return plans.map(serializeCpaPlan);
}

export async function createCpaCommissionPlan(
  offerId: string,
  input: CpaCommissionPlanInput,
): Promise<CpaCommissionPlanDto> {
  await assertCpaOffer(offerId);
  const planId = await prisma.$transaction(async (tx) => {
    const plan = await tx.cpaOfferCommissionPlan.create({
      data: { offerId, name: input.name, payout: input.payout, isActive: input.isActive },
      select: { id: true },
    });
    await setCpaPlanMembers(tx, offerId, plan.id, input.publisherIds);
    return plan.id;
  });
  const plan = await prisma.cpaOfferCommissionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: cpaPlanInclude,
  });
  return serializeCpaPlan(plan);
}

export async function updateCpaCommissionPlan(
  offerId: string,
  planId: string,
  input: CpaCommissionPlanUpdateInput,
): Promise<CpaCommissionPlanDto> {
  const existing = await prisma.cpaOfferCommissionPlan.findFirst({
    where: { id: planId, offerId },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound("Commission plan");

  await prisma.$transaction(async (tx) => {
    await tx.cpaOfferCommissionPlan.update({
      where: { id: planId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.payout !== undefined ? { payout: input.payout } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    if (input.publisherIds) {
      await setCpaPlanMembers(tx, offerId, planId, input.publisherIds);
    }
  });
  const plan = await prisma.cpaOfferCommissionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: cpaPlanInclude,
  });
  return serializeCpaPlan(plan);
}

export async function deleteCpaCommissionPlan(offerId: string, planId: string) {
  const result = await prisma.cpaOfferCommissionPlan.deleteMany({ where: { id: planId, offerId } });
  if (result.count === 0) throw Errors.notFound("Commission plan");
  return { id: planId };
}

/** Active plan payouts for one publisher, keyed by offer id. */
export async function getPublisherCpaPlanPayouts(
  publisherId: string,
  offerIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (offerIds.length === 0) return map;
  const rows = await prisma.cpaOfferCommissionPlanMember.findMany({
    where: { publisherId, offerId: { in: offerIds }, plan: { isActive: true } },
    select: { offerId: true, plan: { select: { payout: true } } },
  });
  for (const row of rows) map.set(row.offerId, Number(row.plan.payout));
  return map;
}

// ---------------------------------------------------------------------------
// Digital product plans
// ---------------------------------------------------------------------------

const digitalPlanInclude = {
  members: memberInclude,
  upsellRates: {
    select: { upsellId: true, commissionPct: true, upsell: { select: { pageSlug: true } } },
  },
} as const;

type DigitalPlanRow = Prisma.DigitalProductCommissionPlanGetPayload<{
  include: typeof digitalPlanInclude;
}>;

function serializeDigitalPlan(plan: DigitalPlanRow): DigitalCommissionPlanDto {
  return {
    id: plan.id,
    productId: plan.productId,
    name: plan.name,
    frontEndCommission: Number(plan.frontEndCommission),
    isActive: plan.isActive,
    upsellRates: plan.upsellRates.map((r) => ({
      upsellId: r.upsellId,
      pageSlug: r.upsell.pageSlug,
      commissionPct: Number(r.commissionPct),
    })),
    members: serializeMembers(plan.members),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/** Returns the product's upsell ids keyed by page slug. */
async function assertDigitalProduct(productId: string) {
  const product = await prisma.digitalProduct.findUnique({
    where: { id: productId },
    select: { id: true, upsells: { select: { id: true, pageSlug: true } } },
  });
  if (!product) throw Errors.notFound("Digital product");
  return new Map(product.upsells.map((u) => [u.pageSlug, u.id]));
}

async function setDigitalPlanUpsellRates(
  tx: Tx,
  planId: string,
  upsellIdBySlug: Map<string, string>,
  rates: { pageSlug: string; commissionPct: number }[],
) {
  const byUpsellId = new Map<string, number>();
  for (const rate of rates) {
    const upsellId = upsellIdBySlug.get(normalizePageSlug(rate.pageSlug) ?? rate.pageSlug);
    if (upsellId) byUpsellId.set(upsellId, rate.commissionPct);
  }
  await tx.digitalProductCommissionPlanUpsell.deleteMany({ where: { planId } });
  if (byUpsellId.size > 0) {
    await tx.digitalProductCommissionPlanUpsell.createMany({
      data: [...byUpsellId].map(([upsellId, commissionPct]) => ({ planId, upsellId, commissionPct })),
    });
  }
}

async function setDigitalPlanMembers(
  tx: Tx,
  productId: string,
  planId: string,
  publisherIds: string[],
) {
  await assertPublishers(tx, publisherIds);
  const existing = await tx.digitalProductCommissionPlanMember.findMany({
    where: { productId, publisherId: { in: publisherIds } },
    select: { publisherId: true, planId: true },
  });
  const conflicts = findCommissionPlanMemberConflicts(existing, planId, publisherIds);
  if (conflicts.length > 0) throw await conflictError(tx, conflicts);

  await tx.digitalProductCommissionPlanMember.deleteMany({
    where: { planId, publisherId: { notIn: publisherIds } },
  });
  const current = new Set(existing.filter((r) => r.planId === planId).map((r) => r.publisherId));
  const toAdd = publisherIds.filter((id) => !current.has(id));
  if (toAdd.length > 0) {
    await tx.digitalProductCommissionPlanMember.createMany({
      data: toAdd.map((publisherId) => ({ planId, productId, publisherId })),
    });
  }
}

export async function listDigitalCommissionPlans(
  productId: string,
): Promise<DigitalCommissionPlanDto[]> {
  await assertDigitalProduct(productId);
  const plans = await prisma.digitalProductCommissionPlan.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    include: digitalPlanInclude,
  });
  return plans.map(serializeDigitalPlan);
}

export async function createDigitalCommissionPlan(
  productId: string,
  input: DigitalCommissionPlanInput,
): Promise<DigitalCommissionPlanDto> {
  const upsellIds = await assertDigitalProduct(productId);
  const planId = await prisma.$transaction(async (tx) => {
    const plan = await tx.digitalProductCommissionPlan.create({
      data: {
        productId,
        name: input.name,
        frontEndCommission: input.frontEndCommission,
        isActive: input.isActive,
      },
      select: { id: true },
    });
    await setDigitalPlanUpsellRates(tx, plan.id, upsellIds, input.upsellRates);
    await setDigitalPlanMembers(tx, productId, plan.id, input.publisherIds);
    return plan.id;
  });
  const plan = await prisma.digitalProductCommissionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: digitalPlanInclude,
  });
  return serializeDigitalPlan(plan);
}

export async function updateDigitalCommissionPlan(
  productId: string,
  planId: string,
  input: DigitalCommissionPlanUpdateInput,
): Promise<DigitalCommissionPlanDto> {
  const upsellIds = await assertDigitalProduct(productId);
  const existing = await prisma.digitalProductCommissionPlan.findFirst({
    where: { id: planId, productId },
    select: { id: true },
  });
  if (!existing) throw Errors.notFound("Commission plan");

  await prisma.$transaction(async (tx) => {
    await tx.digitalProductCommissionPlan.update({
      where: { id: planId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.frontEndCommission !== undefined
          ? { frontEndCommission: input.frontEndCommission }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    if (input.upsellRates) {
      await setDigitalPlanUpsellRates(tx, planId, upsellIds, input.upsellRates);
    }
    if (input.publisherIds) {
      await setDigitalPlanMembers(tx, productId, planId, input.publisherIds);
    }
  });
  const plan = await prisma.digitalProductCommissionPlan.findUniqueOrThrow({
    where: { id: planId },
    include: digitalPlanInclude,
  });
  return serializeDigitalPlan(plan);
}

export async function deleteDigitalCommissionPlan(productId: string, planId: string) {
  const result = await prisma.digitalProductCommissionPlan.deleteMany({
    where: { id: planId, productId },
  });
  if (result.count === 0) throw Errors.notFound("Commission plan");
  return { id: planId };
}

/** Active digital plan rates for one publisher, keyed by product id. */
export async function getPublisherDigitalPlanRates(
  publisherId: string,
  productIds: string[],
): Promise<Map<string, DigitalCommissionPlanRates>> {
  return loadPublisherDigitalPlanRates(publisherId, productIds);
}

// ---------------------------------------------------------------------------
// Publisher search (admin multi-select)
// ---------------------------------------------------------------------------

export async function searchPublishersForCommissionPlan(query: string, limit = 20) {
  const q = query.trim();
  const rows = await prisma.user.findMany({
    where: {
      role: "PUBLISHER",
      status: "ACTIVE",
      ...(q
        ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { id: q }] }
        : {}),
    },
    orderBy: { name: "asc" },
    take: Math.min(Math.max(limit, 1), 50),
    select: { id: true, name: true, email: true },
  });
  return rows;
}
