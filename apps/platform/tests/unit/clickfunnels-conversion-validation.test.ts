import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/clickfunnels-webhook-attribution", () => ({
  resolveDigitalProductWebhookAttribution: vi.fn(),
}));

import {
  buildExternalEventKey,
  validateClickFunnelsConversion,
  type ConversionValidationDeps,
  type StoredSubscriptionAttribution,
} from "@/lib/clickfunnels-conversion-validation";
import { extractClickFunnelsIdentifiers } from "@/lib/clickfunnels-webhook-payload";

const PINSTACK_CF_ID = "cf-pinstack";
const OTHER_CF_ID = "cf-other-product";
const AT = new Date("2026-09-20T10:00:00.000Z");

function makeDeps(overrides: Partial<ConversionValidationDeps> = {}) {
  const subscriptions = new Map<string, StoredSubscriptionAttribution>();
  const deps: ConversionValidationDeps = {
    findMappings: vi.fn(async (ids: string[]) =>
      ids.includes(PINSTACK_CF_ID)
        ? [{ cfProductId: PINSTACK_CF_ID, productId: "prod-pinstack", upsellId: null }]
        : [],
    ),
    resolveBySlug: vi.fn(async () => null),
    findSubscription: vi.fn(async (key: string) => subscriptions.get(key) ?? null),
    resolveAttribution: vi.fn(async () => ({
      publisherId: "pub-aff",
      affiliateRef: "aff-ref",
      clickId: "click-1",
      subId: "s1",
      src: "fb",
    })),
    clickedOnlyOtherProducts: vi.fn(async () => false),
    ...overrides,
  };
  return { deps, subscriptions };
}

function cf2Order(opts: {
  orderId: number;
  productId: string;
  amount?: number;
  subscriptionId?: string;
  eventType?: string;
}) {
  return {
    event_type: opts.eventType ?? "order.completed",
    data: {
      ...(opts.subscriptionId ? { subscription_id: opts.subscriptionId } : {}),
      order: {
        id: opts.orderId,
        total_amount: opts.amount ?? 47,
        line_items: [{ products_variant: { product_id: opts.productId } }],
      },
    },
  };
}

function renewalInvoice(opts: { invoiceId: string; orderId: number; productId: string; subscriptionId: string }) {
  return {
    event_type: "invoice.paid",
    data: {
      id: opts.invoiceId,
      invoice_type: "renewal",
      order_id: opts.orderId,
      subscription_id: opts.subscriptionId,
      total_amount: 9.95,
      line_items: [{ products_variant: { product_id: opts.productId } }],
    },
  };
}

describe("validateClickFunnelsConversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a sale whose CF product is mapped and the affiliate ref resolves", async () => {
    const { deps } = makeDeps();
    const result = await validateClickFunnelsConversion({
      body: cf2Order({ orderId: 1001, productId: PINSTACK_CF_ID }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("PROCESSED");
    expect(result.productId).toBe("prod-pinstack");
    expect(result.cfProductId).toBe(PINSTACK_CF_ID);
    expect(result.publisherId).toBe("pub-aff");
    expect(result.isRecurring).toBe(false);
    expect(result.externalEventKey).toBe(`cf:order:1001:${PINSTACK_CF_ID}`);
  });

  it("rejects an unmapped CF product even when price and page slug would match", async () => {
    const { deps } = makeDeps({
      resolveBySlug: vi.fn(async () => ({ productId: "prod-pinstack", upsellId: null })),
    });
    const body = {
      ...cf2Order({ orderId: 2002, productId: OTHER_CF_ID, amount: 9.95 }),
      page_slug: "pinstack-sales",
    };

    const result = await validateClickFunnelsConversion({ body, at: AT, deps });

    expect(result.status).toBe("IGNORED");
    expect(result.reason).toBe("PRODUCT_NOT_MAPPED");
    expect(result.publisherId).toBeNull();
    expect(result.externalEventKey).toBeNull();
    expect(deps.resolveBySlug).not.toHaveBeenCalled();
    expect(deps.resolveAttribution).not.toHaveBeenCalled();
  });

  it("falls back to an exact page slug only when the payload has no product IDs", async () => {
    const { deps } = makeDeps({
      resolveBySlug: vi.fn(async () => ({ productId: "prod-pinstack", upsellId: null })),
    });
    const result = await validateClickFunnelsConversion({
      body: { event_type: "order.completed", page_slug: "pinstack-sales", data: { order: { id: 3003 } } },
      at: AT,
      deps,
    });

    expect(deps.resolveBySlug).toHaveBeenCalledWith("pinstack-sales");
    expect(result.status).toBe("PROCESSED");
    expect(result.productId).toBe("prod-pinstack");
  });

  it("rejects an organic sale with no Affsense affiliate ref", async () => {
    const { deps } = makeDeps({
      resolveAttribution: vi.fn(async () => ({
        publisherId: null,
        affiliateRef: null,
        clickId: null,
        subId: null,
        src: null,
      })),
    });
    const result = await validateClickFunnelsConversion({
      body: cf2Order({ orderId: 4004, productId: PINSTACK_CF_ID }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("IGNORED");
    expect(result.reason).toBe("NO_AFFSENSE_ATTRIBUTION");
    expect(result.publisherId).toBeNull();
  });

  it("rejects when the affiliate only clicked other products", async () => {
    const { deps } = makeDeps({
      resolveAttribution: vi.fn(async () => ({
        publisherId: "pub-aff",
        affiliateRef: "aff-ref",
        clickId: null,
        subId: null,
        src: null,
      })),
      clickedOnlyOtherProducts: vi.fn(async () => true),
    });
    const result = await validateClickFunnelsConversion({
      body: cf2Order({ orderId: 5005, productId: PINSTACK_CF_ID }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("IGNORED");
    expect(result.reason).toBe("PRODUCT_MISMATCH");
  });

  it("produces the same idempotency key for a retried delivery", async () => {
    const { deps } = makeDeps();
    const body = cf2Order({ orderId: 6006, productId: PINSTACK_CF_ID });
    const first = await validateClickFunnelsConversion({ body, at: AT, deps });
    const retry = await validateClickFunnelsConversion({
      body,
      at: new Date(AT.getTime() + 60_000),
      deps,
    });

    expect(first.externalEventKey).not.toBeNull();
    expect(retry.externalEventKey).toBe(first.externalEventKey);
  });

  it("marks an initial subscription sale to be stored", async () => {
    const { deps } = makeDeps();
    const result = await validateClickFunnelsConversion({
      body: cf2Order({ orderId: 7007, productId: PINSTACK_CF_ID, subscriptionId: "sub-77" }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("PROCESSED");
    expect(result.isRecurring).toBe(false);
    expect(result.storeSubscription).toBe(true);
    expect(result.identifiers.subscriptionKey).toBe("sub-77");
  });

  it("credits a renewal to the original affiliate from the stored subscription", async () => {
    const resolveAttribution = vi.fn(async () => ({
      publisherId: "pub-latest-clicker",
      affiliateRef: "other",
      clickId: "click-9",
      subId: null,
      src: null,
    }));
    const { deps, subscriptions } = makeDeps({ resolveAttribution });
    subscriptions.set("sub-77", {
      productId: "prod-pinstack",
      upsellId: null,
      publisherId: "pub-original",
      clickId: "click-orig",
      subId: "orig-sub",
      src: "orig-src",
      affiliateRef: "orig-ref",
      originalOrderId: "7007",
    });

    const result = await validateClickFunnelsConversion({
      body: renewalInvoice({
        invoiceId: "inv-1",
        orderId: 7007,
        productId: PINSTACK_CF_ID,
        subscriptionId: "sub-77",
      }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("PROCESSED");
    expect(result.isRecurring).toBe(true);
    expect(result.publisherId).toBe("pub-original");
    expect(result.clickId).toBe("click-orig");
    expect(result.storeSubscription).toBe(false);
    expect(result.externalEventKey).toBe("cf:renewal:inv-1");
    expect(resolveAttribution).not.toHaveBeenCalled();
  });

  it("rejects a renewal with no stored subscription attribution", async () => {
    const { deps } = makeDeps();
    const result = await validateClickFunnelsConversion({
      body: renewalInvoice({
        invoiceId: "inv-2",
        orderId: 8008,
        productId: PINSTACK_CF_ID,
        subscriptionId: "sub-unknown",
      }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("IGNORED");
    expect(result.reason).toBe("SUBSCRIPTION_ATTRIBUTION_NOT_FOUND");
    expect(result.isRecurring).toBe(true);
    expect(result.publisherId).toBeNull();
    expect(deps.resolveAttribution).not.toHaveBeenCalled();
  });

  it("rejects a renewal of another product attached to an Affsense subscription", async () => {
    const { deps, subscriptions } = makeDeps({
      findMappings: vi.fn(async () => [
        { cfProductId: PINSTACK_CF_ID, productId: "prod-other-mapped", upsellId: null },
      ]),
    });
    subscriptions.set("sub-77", {
      productId: "prod-pinstack",
      upsellId: null,
      publisherId: "pub-original",
      clickId: null,
      subId: null,
      src: null,
      affiliateRef: null,
      originalOrderId: "7007",
    });

    const result = await validateClickFunnelsConversion({
      body: renewalInvoice({
        invoiceId: "inv-3",
        orderId: 7007,
        productId: PINSTACK_CF_ID,
        subscriptionId: "sub-77",
      }),
      at: AT,
      deps,
    });

    expect(result.status).toBe("IGNORED");
    expect(result.reason).toBe("PRODUCT_MISMATCH");
  });
});

describe("buildExternalEventKey", () => {
  it("keys renewals by payment and orders by order + product", () => {
    const renewalIds = extractClickFunnelsIdentifiers(
      renewalInvoice({ invoiceId: "inv-5", orderId: 1, productId: "p", subscriptionId: "s" }),
    );
    expect(
      buildExternalEventKey({ identifiers: renewalIds, isRecurring: true, productKey: "p", at: AT }),
    ).toBe("cf:renewal:inv-5");

    const orderIds = extractClickFunnelsIdentifiers(cf2Order({ orderId: 42, productId: "p" }));
    expect(
      buildExternalEventKey({ identifiers: orderIds, isRecurring: false, productKey: "p", at: AT }),
    ).toBe("cf:order:42:p");
    expect(
      buildExternalEventKey({ identifiers: orderIds, isRecurring: false, productKey: "upsell-2", at: AT }),
    ).toBe("cf:order:42:upsell-2");
  });
});
