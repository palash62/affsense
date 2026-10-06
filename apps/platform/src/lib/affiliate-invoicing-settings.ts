export const AFFILIATE_INVOICING_SETTINGS_KEY = "affiliate_invoicing";

/** Affiliate invoices fall due this many hours after they are issued. */
export const AFFILIATE_INVOICE_PAYMENT_HOURS = 48;

export type AffiliateInvoicingConfig = {
  version: 1;
  enabled: boolean;
  /** Minimum uninvoiced total required before an invoice is generated. */
  minimumAmount: number;
  /** Legacy; no longer used. Due date is AFFILIATE_INVOICE_PAYMENT_HOURS after issue. */
  netTermDays: number;
  /** Timezone used to resolve Monday/Sunday week boundaries. */
  timezone: string;
  /**
   * Cutover instant. Earnings before this are never invoiced, so publishers are
   * not re-billed for money already withdrawn through the old payout flow.
   */
  startAt: string;
  /**
   * When false, a run bills all uninvoiced earnings up to the run instant instead
   * of the last completed Monday-to-Sunday week (testing mode).
   */
  weeklyCycle: boolean;
};

export type AffiliateInvoicingSettingsApi = Omit<AffiliateInvoicingConfig, "version">;

export const DEFAULT_AFFILIATE_INVOICING_CONFIG: AffiliateInvoicingConfig = {
  version: 1,
  enabled: true,
  minimumAmount: 50,
  netTermDays: 7,
  timezone: "UTC",
  startAt: "",
  weeklyCycle: true,
};

/**
 * Invoices are raised automatically only when invoicing is on with the weekly
 * cycle. Otherwise affiliates request their own invoices.
 */
export function isWeeklyAutoInvoicing(
  config: Pick<AffiliateInvoicingConfig, "enabled" | "weeklyCycle">,
): boolean {
  return config.enabled && config.weeklyCycle;
}

export function clampInvoiceMinimumAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_AFFILIATE_INVOICING_CONFIG.minimumAmount;
  return Math.round(Math.min(100_000, n) * 100) / 100;
}

export function clampInvoiceNetTermDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_AFFILIATE_INVOICING_CONFIG.netTermDays;
  return Math.min(180, Math.floor(n));
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeStartAt(value: unknown): string {
  const raw = coerceString(value).trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

export function parseAffiliateInvoicingConfig(value: unknown): AffiliateInvoicingConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_AFFILIATE_INVOICING_CONFIG };
  }
  const raw = value as Record<string, unknown>;
  return {
    version: 1,
    enabled: raw.enabled !== false,
    minimumAmount: clampInvoiceMinimumAmount(
      raw.minimumAmount ?? DEFAULT_AFFILIATE_INVOICING_CONFIG.minimumAmount,
    ),
    netTermDays: clampInvoiceNetTermDays(
      raw.netTermDays ?? DEFAULT_AFFILIATE_INVOICING_CONFIG.netTermDays,
    ),
    timezone:
      coerceString(raw.timezone).trim() || DEFAULT_AFFILIATE_INVOICING_CONFIG.timezone,
    startAt: normalizeStartAt(raw.startAt),
    weeklyCycle: raw.weeklyCycle !== false,
  };
}

export function toAffiliateInvoicingSettingsApi(
  config: AffiliateInvoicingConfig,
): AffiliateInvoicingSettingsApi {
  return {
    enabled: config.enabled,
    minimumAmount: config.minimumAmount,
    netTermDays: config.netTermDays,
    timezone: config.timezone,
    startAt: config.startAt,
    weeklyCycle: config.weeklyCycle,
  };
}

export function mergeAffiliateInvoicingUpdate(
  existing: AffiliateInvoicingConfig,
  input: {
    enabled?: boolean;
    minimumAmount?: number;
    netTermDays?: number;
    timezone?: string;
    startAt?: string;
    weeklyCycle?: boolean;
  },
): AffiliateInvoicingConfig {
  const next: AffiliateInvoicingConfig = { ...existing };

  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (typeof input.weeklyCycle === "boolean") next.weeklyCycle = input.weeklyCycle;
  if (typeof input.minimumAmount === "number") {
    next.minimumAmount = clampInvoiceMinimumAmount(input.minimumAmount);
  }
  if (typeof input.netTermDays === "number") {
    next.netTermDays = clampInvoiceNetTermDays(input.netTermDays);
  }
  if (typeof input.timezone === "string" && input.timezone.trim()) {
    next.timezone = input.timezone.trim();
  }
  if (typeof input.startAt === "string") next.startAt = normalizeStartAt(input.startAt);

  return next;
}
