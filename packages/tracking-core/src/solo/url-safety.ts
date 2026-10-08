import net from "node:net";
import { assertSafeOutboundUrl } from "../safe-outbound-url";

export type DestinationCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; error: string };

const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost", ".lan", ".home", ".corp"];

/** Synchronous checks for an affiliate landing page URL (no DNS). */
export function checkSoloDestinationUrl(raw: string): DestinationCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "The landing page must use https://" };
  if (url.username || url.password) return { ok: false, error: "The URL must not contain a username or password" };
  if (url.port && url.port !== "443") return { ok: false, error: "Custom ports are not allowed" };
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || net.isIP(host) || !host.includes(".")) {
    return { ok: false, error: "Use a public domain name, not an IP address or local host" };
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return { ok: false, error: "This host is not allowed" };
  }
  for (const [key, value] of url.searchParams) {
    if (/^(https?:)?\/\//i.test(value.trim())) {
      return { ok: false, error: `Remove the redirect parameter "${key}" from the URL` };
    }
  }
  url.searchParams.delete("affs_click_id");
  url.hash = "";
  return { ok: true, url: url.toString(), host };
}

/** Full check including DNS: the host must not resolve to a private address. */
export async function assertSoloDestinationSafe(raw: string): Promise<{ url: string; host: string }> {
  const check = checkSoloDestinationUrl(raw);
  if (!check.ok) throw new Error(check.error);
  await assertSafeOutboundUrl(check.url, { allowHttpLocalhost: false });
  return { url: check.url, host: check.host };
}

/** Destination URL with the canonical click id appended. */
export function appendSoloClickId(destinationUrl: string, soloClickId: string): string {
  const url = new URL(destinationUrl);
  url.searchParams.set("affs_click_id", soloClickId);
  return url.toString();
}
