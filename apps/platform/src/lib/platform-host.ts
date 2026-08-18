export function getPlatformUrl(): string {
  return (
    process.env.PLATFORM_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_PLATFORM_URL?.trim() ||
    process.env.AUTH_URL?.trim() ||
    "http://localhost:3010"
  );
}

const UNUSABLE_REDIRECT_HOSTS = new Set(["0.0.0.0", "127.0.0.1", "::", "[::]"]);

function originFromConfiguredUrl(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (UNUSABLE_REDIRECT_HOSTS.has(url.hostname.toLowerCase())) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function hostnameOf(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith("[") && value.includes("]")) {
    return value.slice(0, value.indexOf("]") + 1);
  }
  return value.split(":")[0] ?? value;
}

/** Public site origin for browser 302s. Never 0.0.0.0 / 127.0.0.1 (Docker listen addresses). */
export function getPublicRedirectOrigin(request: Request): string {
  for (const value of [
    process.env.AUTH_URL,
    process.env.APP_URL,
    process.env.PLATFORM_URL,
    process.env.NEXT_PUBLIC_PLATFORM_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    const origin = originFromConfiguredUrl(value);
    if (origin) return origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost && !UNUSABLE_REDIRECT_HOSTS.has(hostnameOf(forwardedHost))) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  try {
    const fromRequest = new URL(request.url);
    if (!UNUSABLE_REDIRECT_HOSTS.has(fromRequest.hostname.toLowerCase())) {
      return fromRequest.origin;
    }
  } catch {
    // ignore invalid request.url
  }

  return originFromConfiguredUrl(getPlatformUrl()) ?? "http://localhost:3010";
}

export function buildPublicRedirectUrl(request: Request, path: string): URL {
  return new URL(path, `${getPublicRedirectOrigin(request).replace(/\/$/, "")}/`);
}

export function getPlatformHost(): string {
  try {
    return new URL(getPlatformUrl()).host.toLowerCase();
  } catch {
    return "localhost:3010";
  }
}

export function getPlatformHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const value of [
    process.env.PLATFORM_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_PLATFORM_URL,
    process.env.AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ]) {
    if (!value?.trim()) continue;
    try {
      hosts.add(new URL(value.trim()).host.toLowerCase());
    } catch {
      // ignore invalid URLs
    }
  }
  hosts.add("localhost");
  hosts.add("localhost:3010");
  hosts.add("127.0.0.1");
  hosts.add("127.0.0.1:3010");
  return hosts;
}

export function isPlatformHost(host: string | null | undefined): boolean {
  if (!host) return true;
  const normalized = host.toLowerCase().split(":")[0];
  const withPort = host.toLowerCase();
  const platformHosts = getPlatformHosts();
  return (
    platformHosts.has(withPort) ||
    platformHosts.has(normalized) ||
    platformHosts.has(`${normalized}:3010`)
  );
}

export function buildFunnelPublicUrl(input: {
  slug: string;
  appUrl: string;
  customDomain?: string | null;
}): string {
  if (input.customDomain) {
    // Mirror the platform URL's protocol/port so local dev (http://localhost:3010)
    // produces a clickable custom-domain URL like http://mybrand.test:3010.
    try {
      const base = new URL(input.appUrl);
      const port = base.port ? `:${base.port}` : "";
      return `${base.protocol}//${input.customDomain}${port}`;
    } catch {
      return `https://${input.customDomain}`;
    }
  }
  const base = input.appUrl.replace(/\/$/, "");
  return `${base}/o/${input.slug}`;
}
