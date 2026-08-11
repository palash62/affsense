/**
 * Gates advertiser Autoresponder (`/advertiser/email`) visibility.
 *
 * AUTORESPONDER_ADVERTISER_ALLOWLIST:
 * - unset / "" → demo only (advertiser@cpl.local)
 * - "*" → live (all advertisers)
 * - "a@x.com,b@y.com" → only those emails (case-insensitive)
 */
export const AUTORESPONDER_DEMO_ADVERTISER_EMAIL = "advertiser@cpl.local";

export function getAutoresponderAdvertiserAllowlist(): string[] | "live" {
  const raw = process.env.AUTORESPONDER_ADVERTISER_ALLOWLIST;
  if (raw === undefined || raw.trim() === "") {
    return [AUTORESPONDER_DEMO_ADVERTISER_EMAIL];
  }
  const trimmed = raw.trim();
  if (trimmed === "*") {
    return "live";
  }
  return trimmed
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function canAdvertiserAccessAutoresponder(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const allowlist = getAutoresponderAdvertiserAllowlist();
  if (allowlist === "live") return true;
  return allowlist.includes(email.trim().toLowerCase());
}

/** Demo advertiser may send without Autoresponder wallet balance. */
export function isAutoresponderDemoAdvertiser(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return email.trim().toLowerCase() === AUTORESPONDER_DEMO_ADVERTISER_EMAIL;
}
