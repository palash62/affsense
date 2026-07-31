/** Lightweight UA parse — labels match platform campaign targeting constants. */
export function parseUserAgent(userAgent?: string | null): {
  device: string;
  os: string;
  browser: string;
} {
  if (!userAgent?.trim()) {
    return { device: "—", os: "—", browser: "—" };
  }

  const ua = userAgent;
  const isTablet = /ipad|tablet|kindle|playbook/i.test(ua);
  const isMobile =
    isTablet || /mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua);
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
