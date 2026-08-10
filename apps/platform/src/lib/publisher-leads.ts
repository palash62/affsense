import { formatLeadMessage } from "@/lib/advertiser-leads";
import { getLeadCpl } from "@/lib/lead-cpl";
import {
  calculatePublisherPayout,
  type PlatformSettingsConfig,
} from "@/lib/platform-settings";
import { normalizeClientIp } from "@cpl/shared";

/** True when a PAID lead should credit the assigned publisher wallet. */
export function shouldCreditPublisherForLead(lead: {
  publisherId: string;
  trackingLinkId?: string | null;
  campaign: { advertiserId: string };
  publisher?: { role: string } | null;
}): boolean {
  if (lead.publisher?.role === "PUBLISHER") return true;
  if (lead.trackingLinkId) return true;
  return lead.publisherId !== lead.campaign.advertiserId;
}

/** True when a lead should earn publisher payout (smart-link or non-advertiser attribution). */
export function isPublisherEarningLead(lead: {
  publisherId: string;
  trackingLinkId?: string | null;
  campaign: { advertiserId: string };
  publisher?: { role: string } | null;
}): boolean {
  return shouldCreditPublisherForLead(lead);
}

/** @deprecated Use isPublisherEarningLead */
export function isPublisherAttributedLead(lead: {
  publisherId: string;
  trackingLinkId?: string | null;
  campaign: { advertiserId: string };
  publisher?: { role: string } | null;
}): boolean {
  return isPublisherEarningLead(lead);
}

export function shortLeadId(id: string) {
  return id.slice(-8).toUpperCase();
}

export function formatLeadIp(ip?: string | null) {
  return normalizeClientIp(ip) ?? "—";
}

export {
  extractLeadCountry,
  formatLeadCountryDisplay,
} from "@/lib/lead-country";

export function parseUserAgent(userAgent?: string | null): {
  device: string;
  os: string;
  browser: string;
} {
  if (!userAgent?.trim()) {
    return { device: "—", os: "—", browser: "—" };
  }

  const ua = userAgent;
  const isTablet = /ipad|tablet|kindle|playbook|silk/i.test(ua);
  // Android without "Mobile" (e.g. SamsungBrowser) is still a phone unless tablet.
  const isAndroidPhone = /android/i.test(ua) && !isTablet;
  const isMobile =
    isTablet ||
    isAndroidPhone ||
    /mobile|iphone|ipod|windows phone/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod|ios/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "Chrome OS";

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = "Safari";

  return { device, os, browser };
}

export function formatPublisherLeadPayout(
  lead: {
    status: string;
    country: string | null;
    cpl?: number | string | { toString(): string } | null;
    campaign: { cpl: number | string | { toString(): string } };
  },
  settings: PlatformSettingsConfig,
  creditedAmount?: number,
): { label: string; className: string } {
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  const cpl = getLeadCpl(lead);

  if (lead.status === "PAID") {
    const amount =
      creditedAmount ??
      calculatePublisherPayout(cpl, lead.country, settings).publisherAmount;
    return {
      label: currency.format(amount),
      className: "font-semibold text-emerald-700",
    };
  }

  if (lead.status === "APPROVED") {
    const amount = calculatePublisherPayout(cpl, lead.country, settings).publisherAmount;
    return {
      label: `${currency.format(amount)} est.`,
      className: "text-emerald-700",
    };
  }

  if (lead.status === "PENDING" || lead.status === "VALIDATING" || lead.status === "CAPTURED") {
    return { label: "Pending", className: "text-amber-700" };
  }

  return { label: "—", className: "text-muted-foreground" };
}

export function formatLeadRejectReason(lead: {
  status: string;
  validationResults: Array<{ passed: boolean; rule: string; details: string | null }>;
  statusHistory: Array<{ reason: string | null; toStatus: string }>;
}): string {
  if (lead.status !== "REJECTED") return "—";
  return formatLeadMessage(lead);
}
