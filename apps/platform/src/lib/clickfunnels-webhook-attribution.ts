import {
  asRecord,
  collectClickFunnelsUrlCandidates,
  extractParamFromUrl,
  pickString,
} from "./clickfunnels-webhook-payload";

function collectRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const records: Record<string, unknown>[] = [record];

  for (const key of ["contact", "purchase", "order", "customer", "data"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      records.push(nested as Record<string, unknown>);
      // Classic CF: data.order.contact
      const nestedOrder = asRecord((nested as Record<string, unknown>).order);
      if (nestedOrder) {
        records.push(nestedOrder);
        const nestedContact = asRecord(nestedOrder.contact);
        if (nestedContact) records.push(nestedContact);
      }
      const nestedContact = asRecord((nested as Record<string, unknown>).contact);
      if (nestedContact) records.push(nestedContact);
    }
  }

  const customFields = record.custom_fields ?? record.customFields ?? record.attributes;
  if (customFields && typeof customFields === "object" && !Array.isArray(customFields)) {
    records.push(customFields as Record<string, unknown>);
  }

  return records;
}

/**
 * Extract affiliate tracking value from a ClickFunnels-style webhook payload.
 * Supports direct fields and Classic visit landing_page URLs (?affsense_id=...).
 */
export function extractAffiliateRefFromWebhookPayload(
  body: unknown,
  paramName: string,
  requestUrl?: URL,
): string | null {
  const key = paramName.trim() || "affsense_id";
  const keys = [key, key.toLowerCase(), key.toUpperCase()];

  if (requestUrl) {
    for (const candidate of keys) {
      const fromQuery = requestUrl.searchParams.get(candidate);
      if (fromQuery?.trim()) return fromQuery.trim();
    }
  }

  for (const record of collectRecords(body)) {
    const direct = pickString(record, keys);
    if (direct) return direct;
  }

  for (const urlLike of collectClickFunnelsUrlCandidates(body)) {
    const fromUrl = extractParamFromUrl(urlLike, key);
    if (fromUrl) return fromUrl;
  }

  return null;
}
