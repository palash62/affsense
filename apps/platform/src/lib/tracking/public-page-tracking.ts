import {
  googleAdsSendTo,
  type PublicPlatformPixelConfig,
} from "@/lib/tracking/platform-pixel-settings";

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

type GtagFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
    dataLayer?: unknown[];
    gtag?: GtagFn;
    __cplPublicTrackingConfig?: PublicPlatformPixelConfig | null;
  }
}

export type LeadConversionPayload = {
  leadId?: string;
};

/** Meta Advanced Matching fields (browser pixel hashes these). */
export type MetaUserData = {
  em?: string;
  ph?: string;
  fn?: string;
  ln?: string;
  country?: string;
  ct?: string;
  st?: string;
  zp?: string;
};

export type SignupLeadPayload = {
  eventID?: string;
  userData?: MetaUserData;
  contentName?: string;
  contentCategory?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export type PurchasePayload = {
  value: number;
  currency?: string;
  eventID?: string;
};

function safeCall(fn: () => void) {
  try {
    fn();
  } catch {
    // Tracking must never block lead success / redirects.
  }
}

function compactUserData(userData: MetaUserData | undefined): Record<string, string> {
  if (!userData) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(userData)) {
    if (typeof raw !== "string") continue;
    let value = raw.trim();
    if (!value) continue;
    if (key === "em") value = value.toLowerCase();
    if (key === "ph") value = value.replace(/[^\d+]/g, "");
    if (key === "country") value = value.toLowerCase();
    if (value) out[key] = value;
  }
  return out;
}

function splitName(fullName: string): { fn?: string; ln?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { fn: parts[0] };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

/** Build Meta userData from common signup form fields. */
export function metaUserDataFromSignup(input: {
  email?: string;
  phone?: string;
  name?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}): MetaUserData {
  const { fn, ln } = splitName(input.name ?? "");
  return {
    em: input.email,
    ph: input.phone,
    fn,
    ln,
    country: input.country,
    ct: input.city,
    st: input.state,
    zp: input.postalCode,
  };
}

export function setPublicTrackingConfig(config: PublicPlatformPixelConfig | null) {
  if (typeof window === "undefined") return;
  window.__cplPublicTrackingConfig = config;
}

export function getPublicTrackingConfig(): PublicPlatformPixelConfig | null {
  if (typeof window === "undefined") return null;
  return window.__cplPublicTrackingConfig ?? null;
}

export function trackLeadConversion(payload: LeadConversionPayload = {}) {
  const config = getPublicTrackingConfig();
  if (!config) return;

  if (config.meta?.enabled && typeof window !== "undefined" && typeof window.fbq === "function") {
    safeCall(() => {
      if (payload.leadId) {
        window.fbq?.("track", "Lead", {}, { eventID: payload.leadId });
      } else {
        window.fbq?.("track", "Lead");
      }
    });
  }

  if (
    config.googleAds?.enabled &&
    typeof window !== "undefined" &&
    typeof window.gtag === "function"
  ) {
    safeCall(() => {
      window.gtag?.("event", "conversion", {
        send_to: googleAdsSendTo(config.googleAds!),
        ...(payload.leadId ? { transaction_id: payload.leadId } : {}),
      });
    });
  }
}

/**
 * Meta Lead for account signup (Advanced Matching + eventID).
 * Does not fire Google Ads — keep Google tied to opt-in/landing leads.
 */
export function trackSignupLead(payload: SignupLeadPayload = {}) {
  const config = getPublicTrackingConfig();
  if (!config?.meta?.enabled || typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  const pixelId = config.meta.pixelId;
  const matching = compactUserData(payload.userData);
  const customData: Record<string, string> = {};
  if (payload.contentName) customData.content_name = payload.contentName;
  if (payload.contentCategory) customData.content_category = payload.contentCategory;
  if (payload.utmSource) customData.utm_source = payload.utmSource;
  if (payload.utmMedium) customData.utm_medium = payload.utmMedium;
  if (payload.utmCampaign) customData.utm_campaign = payload.utmCampaign;

  safeCall(() => {
    if (Object.keys(matching).length > 0) {
      window.fbq?.("init", pixelId, matching);
    }
    if (payload.eventID) {
      window.fbq?.("track", "Lead", customData, { eventID: payload.eventID });
    } else {
      window.fbq?.("track", "Lead", customData);
    }
  });
}

/** Meta Purchase for successful wallet card deposits. */
export function trackPurchase(payload: PurchasePayload) {
  const config = getPublicTrackingConfig();
  if (!config?.meta?.enabled || typeof window === "undefined" || typeof window.fbq !== "function") {
    return;
  }

  const value = Number(payload.value);
  if (!Number.isFinite(value) || value < 0) return;

  const customData = {
    value,
    currency: (payload.currency ?? "USD").toUpperCase(),
  };

  safeCall(() => {
    if (payload.eventID) {
      window.fbq?.("track", "Purchase", customData, { eventID: payload.eventID });
    } else {
      window.fbq?.("track", "Purchase", customData);
    }
  });
}

export function isAcceptedLeadStatus(status: unknown): boolean {
  if (typeof status !== "string") return true;
  return status.toUpperCase() !== "REJECTED";
}
