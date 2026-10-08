import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Uniform base62 string (rejection sampling, no modulo bias). */
export function randomBase62(length: number): string {
  let out = "";
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= 248) continue;
      out += BASE62[byte % 62];
      if (out.length === length) break;
    }
  }
  return out;
}

export const SOLO_CLICK_ID_PATTERN = /^sc_[0-9A-Za-z]{24}$/;

export function generateSoloClickId(): string {
  return `sc_${randomBase62(24)}`;
}

export function isSoloClickId(value: unknown): value is string {
  return typeof value === "string" && SOLO_CLICK_ID_PATTERN.test(value);
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** A secret shown once to the admin/affiliate; only its hash is stored. */
export function generateSecret(prefix: string): { secret: string; hash: string; prefix: string } {
  const secret = `${prefix}_${randomBase62(40)}`;
  return { secret, hash: sha256Hex(secret), prefix: secret.slice(0, prefix.length + 7) };
}

export function secretMatchesHash(secret: string, hash: string): boolean {
  const a = Buffer.from(sha256Hex(secret), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateSiteKey(): string {
  return `ss_${randomBase62(20)}`;
}

/** Salted IP hash; raw visitor IPs are never stored for Solo clicks. */
export function hashVisitorIp(ip: string): string {
  const salt = process.env.SOLO_IP_HASH_SALT?.trim() || process.env.INTERNAL_SERVICE_TOKEN?.trim() || "affsense-solo";
  return sha256Hex(`${salt}:${ip.trim().toLowerCase()}`);
}

export function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase());
}
