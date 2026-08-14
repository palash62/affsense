import type { Prisma } from "@prisma/client";

export type CpaTrackingMethod = "POSTBACK" | "PIXEL";

export type CpaOfferUrlParam = {
  key: string;
  value: string;
};

export type CpaOfferDetails = {
  offerType?: string;
  approvalTime?: string;
  cookieDuration?: string;
  trackingMethod?: CpaTrackingMethod;
  postbackUrl?: string;
  urlParams?: CpaOfferUrlParam[];
  additionalParams?: string;
  disallowedCountries?: string[];
  allowedTrafficSources?: string[];
  disallowedTrafficSources?: string[];
  devices?: string;
  os?: string;
  creatives?: string[];
  resourceLinks?: string[];
  publishRequested?: boolean;
};

const TRACKING_METHODS: CpaTrackingMethod[] = ["POSTBACK", "PIXEL"];

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function asUrlParams(value: unknown): CpaOfferUrlParam[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as { key?: unknown; value?: unknown };
      const key = typeof row.key === "string" ? row.key.trim() : "";
      const paramValue = typeof row.value === "string" ? row.value.trim() : "";
      if (!key && !paramValue) return null;
      return { key, value: paramValue };
    })
    .filter((item): item is CpaOfferUrlParam => item !== null);
  return items.length ? items : undefined;
}

export function parseCpaOfferDetails(value: unknown): CpaOfferDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const trackingMethod = asString(raw.trackingMethod);
  return {
    offerType: asString(raw.offerType),
    approvalTime: asString(raw.approvalTime),
    cookieDuration: asString(raw.cookieDuration),
    trackingMethod: TRACKING_METHODS.includes(trackingMethod as CpaTrackingMethod)
      ? (trackingMethod as CpaTrackingMethod)
      : undefined,
    postbackUrl: asString(raw.postbackUrl),
    urlParams: asUrlParams(raw.urlParams),
    additionalParams: asString(raw.additionalParams),
    disallowedCountries: asStringList(raw.disallowedCountries),
    allowedTrafficSources: asStringList(raw.allowedTrafficSources),
    disallowedTrafficSources: asStringList(raw.disallowedTrafficSources),
    devices: asString(raw.devices),
    os: asString(raw.os),
    creatives: asStringList(raw.creatives),
    resourceLinks: asStringList(raw.resourceLinks),
    publishRequested: raw.publishRequested === true,
  };
}

export function cpaOfferDetailsToJson(details: CpaOfferDetails | undefined | null): Prisma.InputJsonValue | undefined {
  if (!details) return undefined;
  return parseCpaOfferDetails(details) as Prisma.InputJsonValue;
}
