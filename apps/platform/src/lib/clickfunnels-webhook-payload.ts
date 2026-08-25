/**
 * ClickFunnels Classic (API v2) + flat payload helpers shared by webhook ingest and reports.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function pickString(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = parseFloat(value.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

export function pickMoney(record: Record<string, unknown> | null, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const n = parseMoney(record[key]);
    if (n != null) return n;
  }
  return null;
}

/** Unwrap Classic CF invoice/order/contact nesting from a webhook body. */
export function unwrapClickFunnelsPayload(body: unknown): {
  root: Record<string, unknown>;
  data: Record<string, unknown> | null;
  order: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  funnel: Record<string, unknown> | null;
  purchase: Record<string, unknown> | null;
  visits: Record<string, unknown> | null;
  lineItems: Record<string, unknown>[];
} {
  const root = asRecord(body) ?? {};
  const data = asRecord(root.data);
  const order = asRecord(data?.order) ?? asRecord(root.order);
  const contact =
    asRecord(order?.contact) ??
    asRecord(data?.contact) ??
    asRecord(root.contact) ??
    asRecord(root.customer);
  const funnel = asRecord(root.funnel) ?? asRecord(data?.funnel);
  const purchase = asRecord(root.purchase) ?? asRecord(data?.purchase);
  const visits = asRecord(data?.visits) ?? asRecord(root.visits) ?? asRecord(order?.visits);

  const rawLineItems = data?.line_items ?? order?.line_items ?? root.line_items;
  const lineItems: Record<string, unknown>[] = [];
  if (Array.isArray(rawLineItems)) {
    for (const item of rawLineItems) {
      const rec = asRecord(item);
      if (rec) lineItems.push(rec);
    }
  }

  return { root, data, order, contact, funnel, purchase, visits, lineItems };
}

export function extractLeadFromClickFunnelsPayload(body: unknown): {
  eventType: string;
  leadEmail: string | null;
  leadName: string | null;
} {
  const { root, data, contact } = unwrapClickFunnelsPayload(body);

  const eventType =
    pickString(root, ["event_type", "event", "eventType", "type", "status"]) ??
    pickString(data, ["event_type", "type", "status", "invoice_type"]) ??
    "purchase";

  const leadEmail = pickString(contact, [
    "email_address",
    "email",
    "Email",
    "buyer_email",
    "customer_email",
  ]);

  const first = pickString(contact, ["first_name", "firstName"]);
  const last = pickString(contact, ["last_name", "lastName"]);
  const combined = [first, last].filter(Boolean).join(" ");
  const leadName =
    pickString(contact, ["name", "full_name", "fullName", "buyer_name"]) ??
    (combined || null);

  return { eventType, leadEmail, leadName };
}

function cleanProductLabel(raw: string | null): string | null {
  if (!raw) return null;
  // "Affiliate Marketing Mastery Upgrade $17.00" → strip trailing price
  return raw.replace(/\s*\$[\d,]+(?:\.\d{2})?\s*$/, "").trim() || raw.trim();
}

export function extractOrderFieldsFromClickFunnelsPayload(payload: unknown): {
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
    return {
      orderId: null,
      product: null,
      funnel: null,
      orderType: null,
      amount: null,
      source: null,
      subId: null,
      paymentStatus: null,
    };
  }

  const { root, data, order, contact, funnel, purchase, lineItems } =
    unwrapClickFunnelsPayload(payload);

  const productObj = asRecord(root.product) ?? asRecord(data?.product);
  const productsArr =
    Array.isArray(root.products) && root.products.length > 0
      ? asRecord(root.products[0])
      : null;

  const orderId =
    pickString(order, ["order_number", "id", "order_id"]) ??
    pickString(data, ["order_id", "order_number", "id"]) ??
    pickString(root, ["order_id", "transaction_id"]) ??
    (purchase ? pickString(purchase, ["id", "order_id"]) : null) ??
    // Prefer order.id over top-level subject/data ids when numeric
    (order?.id != null ? String(order.id) : null);

  const product =
    cleanProductLabel(pickString(lineItems[0] ?? null, ["description", "name", "title"])) ??
    (productObj ? pickString(productObj, ["name", "title"]) : null) ??
    pickString(root, ["product_name", "product"]) ??
    (productsArr ? pickString(productsArr, ["name", "title"]) : null);

  const funnelName =
    pickString(funnel, ["name", "title"]) ??
    pickString(root, ["funnel_name", "funnel"]) ??
    pickString(order, ["origination_channel_name", "channel_name"]);

  const orderType =
    pickString(order, ["order_type", "purchase_type", "type"]) ??
    pickString(data, ["invoice_type", "type", "order_type"]) ??
    pickString(root, ["purchase_type", "type", "order_type", "event", "event_type"]) ??
    (purchase ? pickString(purchase, ["purchase_type", "type"]) : null);

  const amount =
    pickMoney(data, ["total_amount", "amount", "total", "price"]) ??
    pickMoney(order, ["total_amount", "amount", "total", "price"]) ??
    pickMoney(lineItems[0] ?? null, ["amount", "total", "price"]) ??
    (purchase ? pickMoney(purchase, ["total", "amount", "price"]) : null) ??
    pickMoney(root, ["amount", "total", "price"]);

  const source =
    pickString(root, ["utm_source", "source"]) ??
    pickString(contact, ["utm_source", "source"]) ??
    pickString(order, ["origination_channel_name"]);

  const subId =
    pickString(root, ["sub_id", "affiliate_sub_id", "subid"]) ??
    pickString(contact, ["sub_id", "subid"]) ??
    (purchase ? pickString(purchase, ["sub_id"]) : null);

  const paymentStatus =
    pickString(data, ["status", "payment_status", "charge_status"]) ??
    pickString(order, ["billing_status", "payment_status", "status"]) ??
    pickString(root, ["payment_status", "charge_status", "payment_state"]) ??
    (purchase ? pickString(purchase, ["payment_status", "charge_status"]) : null);

  return {
    orderId,
    product,
    funnel: funnelName,
    orderType,
    amount,
    source,
    subId,
    paymentStatus,
  };
}

/** Pull tracking param value from a URL string if present. */
export function extractParamFromUrl(urlLike: string, paramName: string): string | null {
  const key = paramName.trim() || "affsense_id";
  try {
    const url = new URL(urlLike);
    for (const candidate of [key, key.toLowerCase(), key.toUpperCase()]) {
      const value = url.searchParams.get(candidate);
      if (value?.trim()) return value.trim();
    }
  } catch {
    // Relative or malformed — try regex fallback
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = urlLike.match(new RegExp(`[?&]${escaped}=([^&#]+)`, "i"));
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]).trim() || null;
      } catch {
        return match[1].trim() || null;
      }
    }
  }
  return null;
}

/** Collect URL-like strings from CF visits / common referral fields. */
export function collectClickFunnelsUrlCandidates(body: unknown): string[] {
  const { root, data, order, visits, contact } = unwrapClickFunnelsPayload(body);
  const out: string[] = [];

  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim() && /https?:\/\/|\?/.test(value)) {
      out.push(value.trim());
    }
  };

  const visitNodes = [
    asRecord(visits?.last_visit),
    asRecord(visits?.last_visit_with_utm),
    asRecord(visits?.first_visit),
    asRecord(data?.last_visit),
    asRecord(root.last_visit),
  ];

  for (const node of visitNodes) {
    if (!node) continue;
    push(node.landing_page);
    push(node.landing_url);
    push(node.url);
    push(node.referrer);
    push(node.referral_url);
  }

  for (const record of [root, data, order, contact]) {
    if (!record) continue;
    push(record.landing_page);
    push(record.landing_url);
    push(record.url);
    push(record.referrer);
    push(record.page_url);
  }

  return out;
}
