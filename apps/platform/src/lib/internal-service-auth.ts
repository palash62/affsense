import { timingSafeEqual } from "crypto";
import { getInternalServiceToken } from "@cpl/shared";

/** Constant-time check of the X-Service-Token header used by internal jobs and the tracking app. */
export function verifyServiceToken(request: Request): boolean {
  const token = getInternalServiceToken();
  const provided = request.headers.get("x-service-token");
  if (!token || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
