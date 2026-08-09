export const EMAIL_MARKETING_CONFIG_KEY = "email_marketing_config";

export type EmailMarketingPlatformConfig = {
  enabled: boolean;
  maxAutomationsPerAdvertiser: number;
  maxSendsPerDay: number;
  /** How many marketing emails $1 of Autoresponder wallet funds covers. */
  emailsPerDollar: number;
};

export const DEFAULT_EMAIL_MARKETING_CONFIG: EmailMarketingPlatformConfig = {
  enabled: true,
  maxAutomationsPerAdvertiser: 10,
  maxSendsPerDay: 5000,
  emailsPerDollar: 100,
};

/** Base URL for tracking pixels and unsubscribe links. */
export function getMarketingAppUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000"
  );
}
