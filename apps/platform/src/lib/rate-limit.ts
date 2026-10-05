/**
 * Lightweight in-memory rate limiter (single process / Docker container).
 * Fail-open: never blocks if key/store misbehaves.
 */

type Bucket = { count: number; resetAt: number };

// Route bundles can each get their own copy of this module; keep one shared store.
const globalForRateLimit = globalThis as typeof globalThis & {
  __rateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalForRateLimit.__rateLimitBuckets ??= new Map<string, Bucket>());

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  try {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
    }

    if (current.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      };
    }

    current.count += 1;
    buckets.set(key, current);
    return {
      allowed: true,
      remaining: Math.max(0, limit - current.count),
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  } catch {
    return { allowed: true, remaining: limit, retryAfterSec: 0 };
  }
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitResponse(retryAfterSec: number) {
  return Response.json(
    {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        status: 429,
      },
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
