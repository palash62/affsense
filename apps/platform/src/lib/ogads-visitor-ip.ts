const EGRESS_CACHE_MS = 10 * 60_000;
let egressCache: { ip: string; expiresAt: number } | null = null;

function stripIp(raw: string): string {
  return raw.trim().replace(/^\[|\]$/g, "");
}

function mappedIpv4(ip: string): string {
  const lower = ip.toLowerCase();
  if (lower.startsWith("::ffff:")) return stripIp(lower.slice(7));
  return ip;
}

/** True when OGAds cannot geo-locate this address (loopback, private, unspecified). */
export function isUnusableOgadsIp(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return true;
  const ip = mappedIpv4(stripIp(raw)).toLowerCase();
  if (
    ip === "unknown" ||
    ip === "localhost" ||
    ip === "::1" ||
    ip === "0:0:0:0:0:0:0:1" ||
    ip === "::" ||
    ip === "0:0:0:0:0:0:0:0" ||
    ip === "0.0.0.0"
  ) {
    return true;
  }
  if (ip.startsWith("127.")) return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m) {
    const octet = Number(m[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:")) return true;
  return false;
}

function visitorIpCandidates(request: Request): string[] {
  const out: string[] = [];
  const push = (value: string | null) => {
    if (!value) return;
    for (const part of value.split(",")) {
      const ip = mappedIpv4(stripIp(part));
      if (ip) out.push(ip);
    }
  };
  push(request.headers.get("cf-connecting-ip"));
  push(request.headers.get("true-client-ip"));
  push(request.headers.get("x-real-ip"));
  push(request.headers.get("x-forwarded-for"));
  return out;
}

async function lookupEgressPublicIp(): Promise<string | null> {
  if (egressCache && egressCache.expiresAt > Date.now()) return egressCache.ip;

  const urls = ["https://api.ipify.org?format=json", "https://api64.ipify.org?format=json"];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;
      const body = (await res.json().catch(() => null)) as { ip?: unknown } | null;
      const ip = typeof body?.ip === "string" ? mappedIpv4(stripIp(body.ip)) : "";
      if (ip && !isUnusableOgadsIp(ip)) {
        egressCache = { ip, expiresAt: Date.now() + EGRESS_CACHE_MS };
        return ip;
      }
    } catch {
      // try next lookup
    }
  }
  return null;
}

/**
 * OGAds requires a geo-locatable public IP. Localhost (::1 / 127.0.0.1) fails with
 * "Unable to find geo data for IP". Prefer a public header, else this host's egress IP.
 */
export async function resolveOgadsVisitorIp(request: Request): Promise<string> {
  for (const ip of visitorIpCandidates(request)) {
    if (!isUnusableOgadsIp(ip)) return ip;
  }
  const egress = await lookupEgressPublicIp();
  if (egress) return egress;
  return "8.8.8.8";
}
