function trimUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/$/, "");
}

function isLocalDevUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getPlatformUrl(): string {
  return trimUrl(
    process.env.NEXT_PUBLIC_PLATFORM_URL ?? process.env.APP_URL ?? process.env.PLATFORM_URL,
    "http://localhost:3000",
  );
}

export function getTrackingUrl(): string {
  // Prefer TRACKING_URL so Docker/runtime env wins over build-time NEXT_PUBLIC_* values.
  const configured = trimUrl(
    process.env.TRACKING_URL ?? process.env.NEXT_PUBLIC_TRACKING_URL,
    "",
  );
  const productionFallback = "https://track.leadtb.com";
  const localFallback = "http://localhost:3001";

  if (configured) {
    if (process.env.NODE_ENV === "production" && isLocalDevUrl(configured)) {
      return productionFallback;
    }
    return configured;
  }

  return process.env.NODE_ENV === "production" ? productionFallback : localFallback;
}

export function getInternalServiceToken(): string | undefined {
  return process.env.INTERNAL_SERVICE_TOKEN?.trim() || undefined;
}
