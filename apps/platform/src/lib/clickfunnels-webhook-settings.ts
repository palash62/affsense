import { randomBytes } from "crypto";

export const CLICKFUNNELS_WEBHOOK_SETTINGS_KEY = "clickfunnels_webhook";

export type ClickFunnelsWebhookConfig = {
  version: 1;
  enabled: boolean;
  name: string;
  affiliateTrackingParam: string;
  webhookSecret: string;
  secretHeaderName: string;
  notes: string;
};

export type ClickFunnelsWebhookSettingsApi = {
  enabled: boolean;
  name: string;
  affiliateTrackingParam: string;
  webhookSecret: string;
  webhookSecretConfigured: boolean;
  secretHeaderName: string;
  notes: string;
};

export const DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG: ClickFunnelsWebhookConfig = {
  version: 1,
  enabled: true,
  name: "ClickFunnels",
  affiliateTrackingParam: "affsense_id",
  webhookSecret: "",
  secretHeaderName: "X-Affsense-Secret",
  notes: "",
};

export function generateWebhookSecret(): string {
  return randomBytes(32).toString("hex");
}

export function parseClickFunnelsWebhookConfig(value: unknown): ClickFunnelsWebhookConfig {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG };
  }
  const raw = value as Record<string, unknown>;
  return {
    version: 1,
    enabled: raw.enabled !== false,
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG.name,
    affiliateTrackingParam:
      typeof raw.affiliateTrackingParam === "string" && raw.affiliateTrackingParam.trim()
        ? raw.affiliateTrackingParam.trim()
        : DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG.affiliateTrackingParam,
    webhookSecret:
      typeof raw.webhookSecret === "string" ? raw.webhookSecret : "",
    secretHeaderName:
      typeof raw.secretHeaderName === "string" && raw.secretHeaderName.trim()
        ? raw.secretHeaderName.trim()
        : DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG.secretHeaderName,
    notes: typeof raw.notes === "string" ? raw.notes : "",
  };
}

export function toClickFunnelsWebhookSettingsApi(
  config: ClickFunnelsWebhookConfig,
): ClickFunnelsWebhookSettingsApi {
  const secret = config.webhookSecret.trim();
  return {
    enabled: config.enabled,
    name: config.name,
    affiliateTrackingParam: config.affiliateTrackingParam,
    // Admin-only settings API: return plaintext so authenticated webhook URL can be copied.
    webhookSecret: secret,
    webhookSecretConfigured: Boolean(secret),
    secretHeaderName: config.secretHeaderName,
    notes: config.notes,
  };
}

export function mergeClickFunnelsWebhookUpdate(
  existing: ClickFunnelsWebhookConfig,
  input: {
    enabled?: boolean;
    name?: string;
    affiliateTrackingParam?: string;
    webhookSecret?: string;
    regenerateSecret?: boolean;
    secretHeaderName?: string;
    notes?: string;
  },
): ClickFunnelsWebhookConfig {
  let webhookSecret = existing.webhookSecret;
  if (input.regenerateSecret) {
    webhookSecret = generateWebhookSecret();
  } else if (typeof input.webhookSecret === "string" && input.webhookSecret.trim()) {
    webhookSecret = input.webhookSecret.trim();
  }

  return {
    version: 1,
    enabled: typeof input.enabled === "boolean" ? input.enabled : existing.enabled,
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : existing.name,
    affiliateTrackingParam:
      typeof input.affiliateTrackingParam === "string" && input.affiliateTrackingParam.trim()
        ? input.affiliateTrackingParam.trim()
        : existing.affiliateTrackingParam,
    webhookSecret,
    secretHeaderName:
      typeof input.secretHeaderName === "string" && input.secretHeaderName.trim()
        ? input.secretHeaderName.trim()
        : existing.secretHeaderName,
    notes: typeof input.notes === "string" ? input.notes : existing.notes,
  };
}

/** Sanitize payload for storage: drop secret-like keys, truncate large strings. */
export function sanitizeWebhookPayload(payload: unknown, maxDepth = 4): unknown {
  if (payload == null) return null;
  if (typeof payload === "string") {
    return payload.length > 2000 ? `${payload.slice(0, 2000)}…` : payload;
  }
  if (typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.slice(0, 50).map((item) => sanitizeWebhookPayload(item, maxDepth - 1));
  }
  if (maxDepth <= 0) return "[truncated]";

  const out: Record<string, unknown> = {};
  const secretKeys = /secret|password|token|authorization/i;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>).slice(0, 40)) {
    if (secretKeys.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    out[key] = sanitizeWebhookPayload(value, maxDepth - 1);
  }
  return out;
}
