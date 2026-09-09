import { prisma } from "@/lib/prisma";
import { derivePageSlugFromUrl, normalizePageSlug } from "@/lib/digital-product-page-slug";

export const DIGITAL_PRODUCT_FALLBACK_COMMISSION_RATE = 0.5;

export type ResolvedDigitalProductCommission = {
  commission: number | null;
  rate: number;
  orderType: "Upsell" | "Front End" | null;
  productName: string | null;
  productId: string | null;
  upsellId: string | null;
  matched: "upsell" | "front_end" | "fallback";
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type UpsellLookupRow = {
  id: string;
  name: string;
  pageSlug: string;
  commissionPct: number;
  productId: string;
};

type FrontEndLookupRow = {
  id: string;
  name: string;
  pageSlug: string;
  frontEndCommission: number;
};

export type DigitalProductCommissionLookup = {
  resolve(pageSlug: string | null | undefined, amount: number | null | undefined): ResolvedDigitalProductCommission;
};

function resolveWithLookup(
  upsellBySlug: Map<string, UpsellLookupRow>,
  frontEndBySlug: Map<string, FrontEndLookupRow>,
  pageSlug: string | null | undefined,
  amount: number | null | undefined,
): ResolvedDigitalProductCommission {
  const money = amount != null && Number.isFinite(amount) ? amount : null;
  const slug = normalizePageSlug(pageSlug);

  if (slug) {
    const upsell = upsellBySlug.get(slug);
    if (upsell) {
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

    const frontEnd = frontEndBySlug.get(slug);
    if (frontEnd) {
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

/** Prefetch upsell + front-end sales-page slugs for bulk order/report mapping. */
export async function loadDigitalProductCommissionLookup(): Promise<DigitalProductCommissionLookup> {
  const [upsells, products] = await Promise.all([
    prisma.digitalProductUpsell.findMany({
      select: {
        id: true,
        name: true,
        pageSlug: true,
        commissionPct: true,
        productId: true,
      },
    }),
    prisma.digitalProduct.findMany({
      where: { salesPageUrl: { not: null } },
      select: {
        id: true,
        name: true,
        salesPageUrl: true,
        frontEndCommission: true,
      },
    }),
  ]);

  const upsellBySlug = new Map<string, UpsellLookupRow>();
  for (const row of upsells) {
    const slug = normalizePageSlug(row.pageSlug);
    if (!slug || upsellBySlug.has(slug)) continue;
    upsellBySlug.set(slug, {
      id: row.id,
      name: row.name,
      pageSlug: slug,
      commissionPct: Number(row.commissionPct),
      productId: row.productId,
    });
  }

  const frontEndBySlug = new Map<string, FrontEndLookupRow>();
  for (const product of products) {
    const slug = derivePageSlugFromUrl(product.salesPageUrl);
    if (!slug || frontEndBySlug.has(slug)) continue;
    frontEndBySlug.set(slug, {
      id: product.id,
      name: product.name,
      pageSlug: slug,
      frontEndCommission: Number(product.frontEndCommission),
    });
  }

  return {
    resolve: (pageSlug, amount) =>
      resolveWithLookup(upsellBySlug, frontEndBySlug, pageSlug, amount),
  };
}

/**
 * Match CF page_slug to a configured upsell or front-end sales page,
 * then compute affiliate commission from amount × commission %.
 */
export async function resolveDigitalProductCommission(input: {
  pageSlug: string | null | undefined;
  amount: number | null | undefined;
}): Promise<ResolvedDigitalProductCommission> {
  const lookup = await loadDigitalProductCommissionLookup();
  return lookup.resolve(input.pageSlug, input.amount);
}
