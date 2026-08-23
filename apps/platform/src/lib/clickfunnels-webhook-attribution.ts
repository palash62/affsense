function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function collectRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== "object") return [];
  const record = body as Record<string, unknown>;
  const records: Record<string, unknown>[] = [record];

  for (const key of ["contact", "purchase", "order", "customer", "data"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      records.push(nested as Record<string, unknown>);
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

  return null;
}
