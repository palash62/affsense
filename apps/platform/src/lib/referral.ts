export const REFERRAL_LEVEL_1_RATE = 0.1;
export const REFERRAL_LEVEL_2_RATE = 0.05;
export const REFERRAL_MIN_PAYOUT = 30;

export const REFERRAL_RATES_SUMMARY = "Earn 10% + 5% on 2 levels";

export const REFERRAL_LEVELS = [
  {
    level: 1,
    label: "Level 1",
    title: "Direct Referrals",
    rate: "10%",
    description: "Earn 10% of the ad spend from users you refer directly.",
    gradient: "var(--theme-gradient-revenue)",
  },
  {
    level: 2,
    label: "Level 2",
    title: "Indirect Referrals",
    rate: "5%",
    description: "Earn 5% from the ad spend of users your referrals refer.",
    gradient: "var(--theme-gradient-approved)",
  },
] as const;

export const REFERRAL_STEPS = [
  {
    step: 1,
    title: "Copy your link",
    description: "Get your unique referral link from this page and copy it.",
  },
  {
    step: 2,
    title: "Share with others",
    description: "Share on social media, email, blogs, or your website.",
  },
  {
    step: 3,
    title: "Earn commissions",
    description: "When referrals sign up and spend on ads, you earn recurring commissions.",
  },
] as const;

export type PublisherReferralSource = "digital" | "cpa";

export const PUBLISHER_REFERRAL_RATES: Record<PublisherReferralSource, number> = {
  digital: 0.1,
  cpa: 0.05,
};

/** Referred-affiliate earnings before this moment never pay a referral commission. */
export const PUBLISHER_REFERRAL_START_AT = new Date("2026-10-08T00:00:00Z");

export const REFERRAL_DIGITAL_REFERENCE = "referral_digital";
export const REFERRAL_DIGITAL_REVERSAL_REFERENCE = "referral_digital_reversal";
export const REFERRAL_CPA_REFERENCE = "referral_cpa";
export const PUBLISHER_REFERRAL_REFERENCES = [
  REFERRAL_DIGITAL_REFERENCE,
  REFERRAL_DIGITAL_REVERSAL_REFERENCE,
  REFERRAL_CPA_REFERENCE,
];

export function publisherReferralCommission(
  source: PublisherReferralSource,
  baseAmount: number,
): number {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  return Math.round(baseAmount * PUBLISHER_REFERRAL_RATES[source] * 100) / 100;
}

export function isPublisherReferralEligible(createdAt: Date): boolean {
  return createdAt.getTime() >= PUBLISHER_REFERRAL_START_AT.getTime();
}

export const PUBLISHER_REFERRAL_RATE_CARDS = [
  {
    source: "digital" as const,
    title: "Digital Products",
    rate: "10%",
    description: "Earn 10% of the commission your referred affiliates make on marketplace sales.",
    gradient: "var(--theme-gradient-revenue)",
  },
  {
    source: "cpa" as const,
    title: "CPA Offers",
    rate: "5%",
    description: "Earn 5% of the payout your referred affiliates make on CPA offer conversions.",
    gradient: "var(--theme-gradient-approved)",
  },
];

export const PUBLISHER_REFERRAL_STEPS = [
  {
    step: 1,
    title: "Copy your link",
    description: "Copy your unique affiliate referral link from this page.",
  },
  {
    step: 2,
    title: "Invite affiliates",
    description: "Share it with marketers, creators and publishers who want to join.",
  },
  {
    step: 3,
    title: "Earn on their sales",
    description: "Get 10% of their Digital Product and 5% of their CPA earnings, paid in your weekly invoice.",
  },
] as const;

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
  }
  return code;
}

export const REFERRAL_COOKIE_NAME = "lv_referral_by";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function buildReferralUrl(origin: string, referralCode: string) {
  return `${origin}/?referral_by=${encodeURIComponent(referralCode)}`;
}

export function buildPublisherReferralUrl(origin: string, referralCode: string) {
  return `${origin}/?referral_by=${encodeURIComponent(referralCode)}`;
}

export function readReferralCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${REFERRAL_COOKIE_NAME}=`));
  if (!match) return "";
  try {
    return decodeURIComponent(match.split("=").slice(1).join("=")).trim();
  } catch {
    return "";
  }
}

export function writeReferralCookie(referralCode: string) {
  if (typeof document === "undefined") return;
  const code = referralCode.trim();
  if (!code) return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${REFERRAL_COOKIE_NAME}=${encodeURIComponent(code)}; Path=/; Max-Age=${REFERRAL_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearReferralCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${REFERRAL_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}
