import { prisma } from "@/lib/prisma";
import { derivePageSlugFromUrl, normalizePageSlug } from "@/lib/digital-product-page-slug";

export const DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE = 0.5;

/** Allow CF totals (tax/fees) to match catalog prices, e.g. $2.00 FE ↔ $2.95 charged. */
export const DIGITAL_PRODUCT_PRICE_MATCH_TOLERANCE = 1;

export type ResolvedDigitalProductCommission = {
  commission: number | null;
  rate: number;
  orderType: "Upsell" | "Front End" | null;
  productName: string | null;
  productId: string | null;
  upsellId: string | null;
  matched: "upsell" | "front_end" | "fallback";
  /** Set when a publisher commission plan replaced the product rate. */
  planId?: string | null;
};

export type DigitalCommissionPlanRates = {
  planId: string;
  isActive?: boolean;
  frontEndCommission: number;
  /** Upsell id → commission %. Upsells without an entry keep the product rate. */
  upsellRates: Map<string, number>;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type UpsellLookupRow = {
  id: string;
  name: string;
  pageSlug: string;
  price: number;
  commissionPct: number;
  productId: string;
};

export type FrontEndLookupRow = {
  id: string;
  name: string;
  pageSlug: string | null;
  price: number;
  frontEndCommission: number;
};

export type DigitalProductCommissionLookup = {
  resolve(pageSlug: string | null | undefined, amount: number | null | undefined): ResolvedDigitalProductCommission;
};

function fromUpsell(upsell: UpsellLookupRow, money: number | null): ResolvedDigitalProductCommission {
  const rate = upsell.commissionPct / 100;
  return {
    commission: money != null ? roundMoney(money * rate) : null,
    rate,
    orderType: "Upsell",
    productName: upsell.name,
    productId: upsell.productId,
    upsellId: upsell.id,
    matched: "upsell",
  };
}

function fromFrontEnd(frontEnd: FrontEndLookupRow, money: number | null): ResolvedDigitalProductCommission {
  const rate = frontEnd.frontEndCommission / 100;
  return {
    commission: money != null ? roundMoney(money * rate) : null,
    rate,
    orderType: "Front End",
    productName: frontEnd.name,
    productId: frontEnd.id,
    upsellId: null,
    matched: "front_end",
  };
}

function resolveByAmount(
  upsells: UpsellLookupRow[],
  frontEnds: FrontEndLookupRow[],
  money: number,
): ResolvedDigitalProductCommission | null {
  type Candidate = { diff: number; resolve: () => ResolvedDigitalProductCommission };
  const candidates: Candidate[] = [];

  for (const upsell of upsells) {
    const diff = Math.abs(upsell.price - money);
    if (diff <= DIGITAL_PRODUCT_PRICE_MATCH_TOLERANCE) {
      candidates.push({ diff, resolve: () => fromUpsell(upsell, money) });
    }
  }

  for (const frontEnd of frontEnds) {
    const diff = Math.abs(frontEnd.price - money);
    if (diff <= DIGITAL_PRODUCT_PRICE_MATCH_TOLERANCE) {
      candidates.push({ diff, resolve: () => fromFrontEnd(frontEnd, money) });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.diff - b.diff);
  return candidates[0]!.resolve();
}

/** Pure resolver used by lookup + unit tests. Amount match wins over page slug. */
export function resolveWithLookup(
  upsellBySlug: Map<string, UpsellLookupRow>,
  frontEndBySlug: Map<string, FrontEndLookupRow>,
  upsells: UpsellLookupRow[],
  frontEnds: FrontEndLookupRow[],
  pageSlug: string | null | undefined,
  amount: number | null | undefined,
): ResolvedDigitalProductCommission {
  const money = amount != null && Number.isFinite(amount) ? amount : null;

  if (money != null) {
    const byAmount = resolveByAmount(upsells, frontEnds, money);
    if (byAmount) return byAmount;
  }

  const slug = normalizePageSlug(pageSlug);
  if (slug) {
    const upsell = upsellBySlug.get(slug);
    if (upsell) return fromUpsell(upsell, money);

    const frontEnd = frontEndBySlug.get(slug);
    if (frontEnd) return fromFrontEnd(frontEnd, money);
  }

  return {
    commission: money != null ? roundMoney(money * DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE) : null,
    rate: DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE,
    orderType: null,
    productName: null,
    productId: null,
    upsellId: null,
    matched: "fallback",
  };
}

/** Build an in-memory lookup from raw catalog rows (testable without Prisma). */
export function buildDigitalProductCommissionLookup(input: {
  upsells: Array<{
    id: string;
    name: string;
    pageSlug: string;
    price: number | string;
    commissionPct: number | string;
    productId: string;
  }>;
  products: Array<{
    id: string;
    name: string;
    salesPageUrl: string | null;
    price: number | string;
    frontEndCommission: number | string;
    /** Additional front-end sales page slugs that credit this product. */
    salesPageSlugs?: string[];
  }>;
}): DigitalProductCommissionLookup {
  const upsells: UpsellLookupRow[] = [];
  const upsellBySlug = new Map<string, UpsellLookupRow>();
  for (const row of input.upsells) {
    const slug = normalizePageSlug(row.pageSlug);
    const entry: UpsellLookupRow = {
      id: row.id,
      name: row.name,
      pageSlug: slug ?? "",
      price: Number(row.price),
      commissionPct: Number(row.commissionPct),
      productId: row.productId,
    };
    upsells.push(entry);
    if (slug && !upsellBySlug.has(slug)) upsellBySlug.set(slug, entry);
  }

  const frontEnds: FrontEndLookupRow[] = [];
  const frontEndBySlug = new Map<string, FrontEndLookupRow>();
  for (const product of input.products) {
    const slug = derivePageSlugFromUrl(product.salesPageUrl);
    const entry: FrontEndLookupRow = {
      id: product.id,
      name: product.name,
      pageSlug: slug,
      price: Number(product.price),
      frontEndCommission: Number(product.frontEndCommission),
    };
    frontEnds.push(entry);
    if (slug && !frontEndBySlug.has(slug)) frontEndBySlug.set(slug, entry);
    for (const raw of product.salesPageSlugs ?? []) {
      const extraSlug = normalizePageSlug(raw);
      if (extraSlug && !frontEndBySlug.has(extraSlug)) frontEndBySlug.set(extraSlug, entry);
    }
  }

  return {
    resolve: (pageSlug, amount) =>
      resolveWithLookup(upsellBySlug, frontEndBySlug, upsells, frontEnds, pageSlug, amount),
  };
}

/** Prefetch upsell + front-end catalog for bulk order/report mapping. */
export async function loadDigitalProductCommissionLookup(): Promise<DigitalProductCommissionLookup> {
  const [upsells, products] = await Promise.all([
    prisma.digitalProductUpsell.findMany({
      select: {
        id: true,
        name: true,
        pageSlug: true,
        price: true,
        commissionPct: true,
        productId: true,
      },
    }),
    prisma.digitalProduct.findMany({
      select: {
        id: true,
        name: true,
        salesPageUrl: true,
        price: true,
        frontEndCommission: true,
        salesPages: { select: { pageSlug: true } },
      },
    }),
  ]);

  return buildDigitalProductCommissionLookup({
    upsells: upsells.map((row) => ({
      id: row.id,
      name: row.name,
      pageSlug: row.pageSlug,
      price: Number(row.price),
      commissionPct: Number(row.commissionPct),
      productId: row.productId,
    })),
    products: products.map((row) => ({
      id: row.id,
      name: row.name,
      salesPageUrl: row.salesPageUrl,
      price: Number(row.price),
      frontEndCommission: Number(row.frontEndCommission),
      salesPageSlugs: row.salesPages.map((page) => page.pageSlug),
    })),
  });
}

/**
 * Match CF amount (preferred) or page_slug to a configured upsell / front-end,
 * then compute affiliate commission from amount × commission %.
 */
export async function resolveDigitalProductCommission(input: {
  pageSlug: string | null | undefined;
  amount: number | null | undefined;
}): Promise<ResolvedDigitalProductCommission> {
  const lookup = await loadDigitalProductCommissionLookup();
  return lookup.resolve(input.pageSlug, input.amount);
}

/** Replace the matched front-end / upsell rate with the publisher's plan rate. */
export function applyDigitalCommissionPlan(
  resolved: ResolvedDigitalProductCommission,
  plan: DigitalCommissionPlanRates | null | undefined,
  amount: number | null | undefined,
): ResolvedDigitalProductCommission {
  if (!plan || plan.isActive === false) return resolved;

  let pct: number | undefined;
  if (resolved.matched === "front_end") {
    pct = plan.frontEndCommission;
  } else if (resolved.matched === "upsell" && resolved.upsellId) {
    pct = plan.upsellRates.get(resolved.upsellId);
  }
  if (pct == null || !Number.isFinite(pct)) return resolved;

  const money = amount != null && Number.isFinite(amount) ? amount : null;
  const rate = pct / 100;
  return {
    ...resolved,
    rate,
    commission: money != null ? roundMoney(money * rate) : null,
    planId: plan.planId,
  };
}

/** Active plan rates for one publisher, keyed by product id. */
export async function loadPublisherDigitalPlanRates(
  publisherId: string,
  productIds: string[],
): Promise<Map<string, DigitalCommissionPlanRates>> {
  const map = new Map<string, DigitalCommissionPlanRates>();
  if (!publisherId || productIds.length === 0) return map;
  const rows = await prisma.digitalProductCommissionPlanMember.findMany({
    where: { publisherId, productId: { in: productIds }, plan: { isActive: true } },
    select: {
      productId: true,
      plan: {
        select: {
          id: true,
          frontEndCommission: true,
          upsellRates: { select: { upsellId: true, commissionPct: true } },
        },
      },
    },
  });
  for (const row of rows) {
    map.set(row.productId, {
      planId: row.plan.id,
      isActive: true,
      frontEndCommission: Number(row.plan.frontEndCommission),
      upsellRates: new Map(row.plan.upsellRates.map((r) => [r.upsellId, Number(r.commissionPct)])),
    });
  }
  return map;
}

/** Resolve commission, then apply the publisher's active plan for the matched product. */
export async function resolveDigitalProductCommissionForPublisher(
  lookup: DigitalProductCommissionLookup,
  pageSlug: string | null | undefined,
  amount: number | null | undefined,
  publisherId: string | null | undefined,
): Promise<ResolvedDigitalProductCommission> {
  const resolved = lookup.resolve(pageSlug, amount);
  if (!publisherId || !resolved.productId || resolved.matched === "fallback") return resolved;
  const plans = await loadPublisherDigitalPlanRates(publisherId, [resolved.productId]);
  return applyDigitalCommissionPlan(resolved, plans.get(resolved.productId), amount);
}

export type DigitalCommissionSnapshot = {
  commissionAmount?: { toString(): string } | number | null;
  commissionRate?: { toString(): string } | number | null;
  digitalCommissionPlanId?: string | null;
};

/** Prefer the commission saved at sale time; old events keep the recalculated value. */
export function applyDigitalCommissionSnapshot(
  resolved: ResolvedDigitalProductCommission,
  snapshot: DigitalCommissionSnapshot | null | undefined,
): ResolvedDigitalProductCommission {
  if (snapshot?.commissionAmount == null) return resolved;
  const commission = Number(snapshot.commissionAmount);
  if (!Number.isFinite(commission)) return resolved;
  const ratePct = snapshot.commissionRate != null ? Number(snapshot.commissionRate) : null;
  return {
    ...resolved,
    commission,
    rate: ratePct != null && Number.isFinite(ratePct) ? ratePct / 100 : resolved.rate,
    planId: snapshot.digitalCommissionPlanId ?? resolved.planId ?? null,
  };
}
