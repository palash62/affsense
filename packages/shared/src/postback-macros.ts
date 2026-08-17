export const GLOBAL_POSTBACK_MACROS = [
  { macro: "{click_id}", description: "Unique Affiliate Click Id" },
  { macro: "{payout}", description: "Payout" },
  { macro: "{currency}", description: "Currency" },
  { macro: "{aff_id}", description: "Affiliate Id" },
  { macro: "{aff_eid}", description: "Affiliate Encrypted Id" },
  { macro: "{offer_id}", description: "Offer Id" },
  { macro: "{source}", description: "Source" },
  { macro: "{date}", description: "Date" },
  { macro: "{sub1}", description: "Sub 1" },
  { macro: "{sub2}", description: "Sub 2" },
  { macro: "{sub3}", description: "Sub 3" },
  { macro: "{sub4}", description: "Sub 4" },
] as const;

export const PUBLISHER_POSTBACK_MACROS = [
  { macro: "{click_id}", description: "Lead / conversion id" },
  { macro: "{lead_id}", description: "Lead id" },
  { macro: "{payout}", description: "Publisher payout" },
  { macro: "{currency}", description: "Currency" },
  { macro: "{aff_id}", description: "Publisher id" },
  { macro: "{offer_id}", description: "Campaign id" },
  { macro: "{source}", description: "Source" },
  { macro: "{date}", description: "Date" },
  { macro: "{sub1}", description: "Sub ID" },
] as const;

export type PostbackMacroContext = {
  clickId?: string | null;
  leadId?: string | null;
  payout?: string | number | null;
  currency?: string | null;
  affId?: string | null;
  affEid?: string | null;
  offerId?: string | null;
  source?: string | null;
  date?: string | null;
  sub1?: string | null;
  sub2?: string | null;
  sub3?: string | null;
  sub4?: string | null;
};

function asEncodedValue(value: string | number | null | undefined): string {
  if (value == null) return "";
  return encodeURIComponent(String(value));
}

/** Replace AffSense-style macros; values are URL-encoded for safe query substitution. */
export function substitutePostbackMacros(
  template: string,
  context: PostbackMacroContext,
): string {
  const map: Record<string, string> = {
    "{click_id}": asEncodedValue(context.clickId),
    "{aff_click_id}": asEncodedValue(context.clickId),
    "{lead_id}": asEncodedValue(context.leadId ?? context.clickId),
    "{payout}": asEncodedValue(context.payout),
    "{currency}": asEncodedValue(context.currency ?? "USD"),
    "{aff_id}": asEncodedValue(context.affId),
    "{aff_eid}": asEncodedValue(context.affEid ?? context.affId),
    "{offer_id}": asEncodedValue(context.offerId),
    "{source}": asEncodedValue(context.source),
    "{date}": asEncodedValue(context.date ?? new Date().toISOString().slice(0, 10)),
    "{sub1}": asEncodedValue(context.sub1),
    "{sub2}": asEncodedValue(context.sub2),
    "{sub3}": asEncodedValue(context.sub3),
    "{sub4}": asEncodedValue(context.sub4),
  };

  let result = template;
  for (const [token, value] of Object.entries(map)) {
    result = result.split(token).join(value);
  }
  return result;
}

/** Click-id tokens replaced when redirecting traffic to a network tracking URL. */
export const CLICK_ID_MACRO_TOKENS = [
  "{click_id}",
  "{aff_click_id}",
  "[click_id]",
  "[aff_click_id]",
  // After URL parsing/serialization, brace macros are percent-encoded.
  "%7Bclick_id%7D",
  "%7Baff_click_id%7D",
  "%5Bclick_id%5D",
  "%5Baff_click_id%5D",
] as const;

function trackingUrlHasClickIdMacro(destination: string): boolean {
  return CLICK_ID_MACRO_TOKENS.some((token) => destination.includes(token));
}

/** Replace all supported click-id macro tokens with the platform click id. */
export function replaceClickIdMacros(destination: string, clickId: string): string {
  let result = destination;
  for (const token of CLICK_ID_MACRO_TOKENS) {
    result = result.split(token).join(clickId);
  }
  return result;
}

export function injectClickIdIntoTrackingUrl(
  destination: string,
  clickId: string,
  requestOrigin: string,
): string {
  if (trackingUrlHasClickIdMacro(destination)) {
    return replaceClickIdMacros(destination, clickId);
  }

  try {
    const target = destination.startsWith("/")
      ? new URL(destination, requestOrigin)
      : new URL(destination);
    target.searchParams.set("click_id", clickId);
    return target.toString();
  } catch {
    const joiner = destination.includes("?") ? "&" : "?";
    return `${destination}${joiner}click_id=${encodeURIComponent(clickId)}`;
  }
}
