import { SMART_LINK_PLATFORMS } from "@/lib/smart-link";

export const LEAD_SOURCE_FILTER_OPTIONS = [
  { value: "all", label: "All sources" },
  ...SMART_LINK_PLATFORMS.map((p) => ({ value: p.id, label: p.label })),
  { value: "optin", label: "Opt-in page" },
  { value: "landing_page", label: "Landing page" },
  { value: "campaign_test", label: "Campaign test" },
] as const;

export const LEAD_SOURCE_FILTER_VALUES = LEAD_SOURCE_FILTER_OPTIONS.map((o) => o.value);

export function normalizeLeadSourceFilter(value: string | null): string {
  if (!value) return "all";
  return LEAD_SOURCE_FILTER_VALUES.includes(value as (typeof LEAD_SOURCE_FILTER_VALUES)[number])
    ? value
    : "all";
}
