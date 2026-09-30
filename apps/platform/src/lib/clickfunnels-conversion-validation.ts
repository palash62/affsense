import { prisma } from "@/lib/prisma";
import {
  extractClickFunnelsIdentifiers,
  extractPageSlugFromClickFunnelsPayload,
  type ClickFunnelsIdentifiers,
} from "@/lib/clickfunnels-webhook-payload";
import {
  resolveDigitalProductWebhookAttribution,
  type DigitalProductWebhookAttribution,
} from "@/lib/clickfunnels-webhook-attribution";
import { derivePageSlugFromUrl, normalizePageSlug } from "@/lib/digital-product-page-slug";

export const CONVERSION_REJECT_REASONS = {
  NO_AFFSENSE_ATTRIBUTION: "No Affsense affiliate tracking on this sale",
  PRODUCT_NOT_MAPPED: "ClickFunnels product is not linked to an Affsense product",
  PRODUCT_MISMATCH: "Affiliate click was for a different product",
  SUBSCRIPTION_ATTRIBUTION_NOT_FOUND:
    "Recurring payment for a subscription not originally referred through Affsense",
} as const;

export type ConversionRejectReason = keyof typeof CONVERSION_REJECT_REASONS;

/** Window for the "clicked a different product" check. */
export const PRODUCT_MISMATCH_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export type ResolvedCfProduct = {
  productId: string;
  upsellId: string | null;
  cfProductId: string | null;
};

export type StoredSubscriptionAttribution = {
  productId: string;
  upsellId: string | null;
  publisherId: string;
  clickId: string | null;
  subId: string | null;
  src: string | null;
  affiliateRef: string | null;
  originalOrderId: string | null;
};

export type ConversionValidationDeps = {
  findMappings(cfProductIds: string[]): Promise<Array<{ cfProductId: string; productId: string; upsellId: string | null }>>;
  resolveBySlug(pageSlug: string): Promise<{ productId: string; upsellId: string | null } | null>;
  findSubscription(subscriptionKey: string): Promise<StoredSubscriptionAttribution | null>;
  resolveAttribution(productId: string): Promise<DigitalProductWebhookAttribution>;
  /** True when the publisher has recent clicks, none of them on `productId`. */
  clickedOnlyOtherProducts(publisherId: string, productId: string, at: Date): Promise<boolean>;
};

export type ConversionValidationResult = {
  status: "PROCESSED" | "IGNORED";
  reason: ConversionRejectReason | null;
  identifiers: ClickFunnelsIdentifiers;
  cfProductId: string | null;
  productId: string | null;
  upsellId: string | null;
  publisherId: string | null;
  affiliateRef: string | null;
  clickId: string | null;
  subId: string | null;
  src: string | null;
  isRecurring: boolean;
  /** Idempotency key; set only for PROCESSED events. */
  externalEventKey: string | null;
  /** Save subscription attribution after insert (initial subscription sale). */
  storeSubscription: boolean;
};

function dayKey(at: Date) {
  return at.toISOString().slice(0, 10);
}

export function buildExternalEventKey(input: {
  identifiers: ClickFunnelsIdentifiers;
  isRecurring: boolean;
  productKey: string | null;
  at: Date;
}): string | null {
  const { identifiers: ids, isRecurring, productKey, at } = input;
  const product = productKey ?? "";
  let key: string | null = null;
  if (ids.isRefund) {
    const ref = ids.paymentId ?? ids.orderId;
    key = ref ? `refund:${ref}:${product}` : null;
  } else if (isRecurring) {
    if (ids.paymentId) key = `renewal:${ids.paymentId}`;
    else if (ids.subscriptionKey) key = `renewal:${ids.subscriptionKey}:${dayKey(at)}`;
  } else if (ids.orderId) {
    key = `order:${ids.orderId}:${product}`;
  } else if (ids.paymentId) {
    key = `payment:${ids.paymentId}:${product}`;
  }
  return key ? `cf:${key}`.slice(0, 191) : null;
}

async function resolveProduct(
  identifiers: ClickFunnelsIdentifiers,
  body: unknown,
  deps: ConversionValidationDeps,
): Promise<ResolvedCfProduct | null> {
  if (identifiers.productIds.length > 0) {
    const mappings = await deps.findMappings(identifiers.productIds);
    for (const id of identifiers.productIds) {
      const match = mappings.find((m) => m.cfProductId === id);
      if (match) return { productId: match.productId, upsellId: match.upsellId, cfProductId: id };
    }
    // Payload names its products and none are ours — never guess from page or price.
    return null;
  }
  const slug = extractPageSlugFromClickFunnelsPayload(body);
  if (!slug) return null;
  const bySlug = await deps.resolveBySlug(slug);
  return bySlug ? { ...bySlug, cfProductId: null } : null;
}

export async function validateClickFunnelsConversion(input: {
  body: unknown;
  at?: Date;
  deps?: ConversionValidationDeps;
  platformParam?: string | null;
  requestUrl?: URL;
}): Promise<ConversionValidationResult> {
  const at = input.at ?? new Date();
  const deps =
    input.deps ??
    createPrismaConversionDeps({
      body: input.body,
      at,
      platformParam: input.platformParam,
      requestUrl: input.requestUrl,
    });
  const identifiers = extractClickFunnelsIdentifiers(input.body);

  const base: ConversionValidationResult = {
    status: "IGNORED",
    reason: null,
    identifiers,
    cfProductId: identifiers.productIds[0] ?? null,
    productId: null,
    upsellId: null,
    publisherId: null,
    affiliateRef: null,
    clickId: null,
    subId: null,
    src: null,
    isRecurring: false,
    externalEventKey: null,
    storeSubscription: false,
  };

  const product = await resolveProduct(identifiers, input.body, deps);
  if (!product) return { ...base, reason: "PRODUCT_NOT_MAPPED" };

  const withProduct: ConversionValidationResult = {
    ...base,
    cfProductId: product.cfProductId ?? base.cfProductId,
    productId: product.productId,
    upsellId: product.upsellId,
  };
  const productKey = product.cfProductId ?? product.upsellId ?? product.productId;

  const subscription = identifiers.subscriptionKey
    ? await deps.findSubscription(identifiers.subscriptionKey)
    : null;
  const sameOrderAsOriginal =
    subscription?.originalOrderId != null &&
    identifiers.orderId != null &&
    subscription.originalOrderId === identifiers.orderId;
  const isRecurring =
    !identifiers.isRefund &&
    (identifiers.renewalHint || (subscription != null && !sameOrderAsOriginal));

  if (isRecurring) {
    if (!subscription) {
      return { ...withProduct, isRecurring, reason: "SUBSCRIPTION_ATTRIBUTION_NOT_FOUND" };
    }
    if (subscription.productId !== product.productId) {
      return { ...withProduct, isRecurring, reason: "PRODUCT_MISMATCH" };
    }
    return {
      ...withProduct,
      status: "PROCESSED",
      isRecurring,
      upsellId: product.upsellId ?? subscription.upsellId,
      publisherId: subscription.publisherId,
      affiliateRef: subscription.affiliateRef,
      clickId: subscription.clickId,
      subId: subscription.subId,
      src: subscription.src,
      externalEventKey: buildExternalEventKey({ identifiers, isRecurring, productKey, at }),
    };
  }

  const attribution = await deps.resolveAttribution(product.productId);
  if (!attribution.publisherId) {
    return {
      ...withProduct,
      affiliateRef: attribution.affiliateRef,
      reason: "NO_AFFSENSE_ATTRIBUTION",
    };
  }
  if (
    !attribution.clickId &&
    (await deps.clickedOnlyOtherProducts(attribution.publisherId, product.productId, at))
  ) {
    return {
      ...withProduct,
      publisherId: null,
      affiliateRef: attribution.affiliateRef,
      reason: "PRODUCT_MISMATCH",
    };
  }

  return {
    ...withProduct,
    status: "PROCESSED",
    publisherId: attribution.publisherId,
    affiliateRef: attribution.affiliateRef,
    clickId: attribution.clickId,
    subId: attribution.subId,
    src: attribution.src,
    externalEventKey: buildExternalEventKey({ identifiers, isRecurring: false, productKey, at }),
    storeSubscription: Boolean(identifiers.subscriptionKey) && !subscription && !identifiers.isRefund,
  };
}

export function createPrismaConversionDeps(ctx: {
  body: unknown;
  at: Date;
  platformParam?: string | null;
  requestUrl?: URL;
}): ConversionValidationDeps {
  return {
    async findMappings(cfProductIds) {
      return prisma.digitalProductCfMapping.findMany({
        where: { cfProductId: { in: cfProductIds } },
        select: { cfProductId: true, productId: true, upsellId: true },
      });
    },
    async resolveBySlug(rawSlug) {
      const slug = normalizePageSlug(rawSlug);
      if (!slug) return null;
      const upsell = await prisma.digitalProductUpsell.findFirst({
        where: { pageSlug: slug },
        select: { id: true, productId: true },
      });
      if (upsell) return { productId: upsell.productId, upsellId: upsell.id };
      const page = await prisma.digitalProductSalesPage.findFirst({
        where: { pageSlug: slug },
        select: { productId: true },
      });
      if (page) return { productId: page.productId, upsellId: null };
      const products = await prisma.digitalProduct.findMany({
        where: { salesPageUrl: { not: null } },
        select: { id: true, salesPageUrl: true },
      });
      const match = products.find((p) => derivePageSlugFromUrl(p.salesPageUrl) === slug);
      return match ? { productId: match.id, upsellId: null } : null;
    },
    async findSubscription(subscriptionKey) {
      return prisma.digitalProductSubscriptionAttribution.findUnique({
        where: { cfSubscriptionId: subscriptionKey },
        select: {
          productId: true,
          upsellId: true,
          publisherId: true,
          clickId: true,
          subId: true,
          src: true,
          affiliateRef: true,
          originalOrderId: true,
        },
      });
    },
    async resolveAttribution(productId) {
      return resolveDigitalProductWebhookAttribution({
        body: ctx.body,
        platformParam: ctx.platformParam,
        requestUrl: ctx.requestUrl,
        at: ctx.at,
        productId,
      });
    },
    async clickedOnlyOtherProducts(publisherId, productId, at) {
      const since = new Date(at.getTime() - PRODUCT_MISMATCH_LOOKBACK_MS);
      const [onProduct, anyClick] = await Promise.all([
        prisma.digitalProductClick.count({
          where: { publisherId, productId, createdAt: { gte: since, lte: at } },
        }),
        prisma.digitalProductClick.count({
          where: { publisherId, createdAt: { gte: since, lte: at } },
        }),
      ]);
      return anyClick > 0 && onProduct === 0;
    },
  };
}
