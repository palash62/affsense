import { createHash } from "node:crypto";

export function buildPromotionVisitorKey(ip: string | null, userAgent: string | null): string {
  return createHash("sha256")
    .update(`${ip ?? ""}|${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}
