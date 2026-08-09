import type { EmailMarketingPlatformConfig } from "@/lib/email/email-marketing-settings";
import { DEFAULT_EMAIL_MARKETING_CONFIG } from "@/lib/email/email-marketing-settings";

export function parseEmailMarketingConfig(value: unknown): EmailMarketingPlatformConfig {
  if (!value || typeof value !== "object") return DEFAULT_EMAIL_MARKETING_CONFIG;
  const raw = value as Record<string, unknown>;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_EMAIL_MARKETING_CONFIG.enabled,
    maxAutomationsPerAdvertiser:
      typeof raw.maxAutomationsPerAdvertiser === "number"
        ? raw.maxAutomationsPerAdvertiser
        : DEFAULT_EMAIL_MARKETING_CONFIG.maxAutomationsPerAdvertiser,
    maxSendsPerDay:
      typeof raw.maxSendsPerDay === "number"
        ? raw.maxSendsPerDay
        : DEFAULT_EMAIL_MARKETING_CONFIG.maxSendsPerDay,
  };
}
