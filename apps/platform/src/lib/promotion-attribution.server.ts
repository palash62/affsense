import { createHash } from "node:crypto";

export function buildPromotionVisitorKey(ip: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}
