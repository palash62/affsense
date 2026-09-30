/** Platform sender/recipient addresses for affsense.com (overridable via env). */
function mailgunFromAddress(): string {
  const raw = process.env.MAILGUN_FROM?.trim();
  if (!raw) return "noreply@mg.affsense.com";
  const match = raw.match(/<([^>]+)>/);
  return match?.[1]?.trim() || raw;
}

export const PLATFORM_EMAILS = {
  noreply: mailgunFromAddress(),
  support: process.env.SUPPORT_EMAIL?.trim() || "support@affsense.com",
  admin: process.env.ADMIN_ALERT_EMAIL?.trim() || "admin@affsense.com",
  supportTelegram: process.env.SUPPORT_TELEGRAM?.trim().replace(/^@/, "") || "yuvrajlushte",
  fromDisplay:
    process.env.MAILGUN_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    "Affsense <noreply@mg.affsense.com>",
} as const;

export function formatSupportFrom(email: string) {
  return `Affsense <${email.trim()}>`;
}
