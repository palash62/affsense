import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Submissions faster than this after the form mounted are treated as bots. */
export const MIN_SIGNUP_FILL_MS = 3000;

const TEN_MINUTES_MS = 10 * 60_000;
const ONE_HOUR_MS = 60 * 60_000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export type SignupGuardResult = { ok: true } | { ok: false; response: Response };

type SignupGuardBody = {
  email?: unknown;
  turnstileToken?: unknown;
  company_website?: unknown;
  formStartedAt?: unknown;
};

/** Looks like a normal success so bots don't learn they were filtered. */
function silentRejectResponse() {
  return Response.json(
    { message: "Check your email to verify your address." },
    { status: 201 },
  );
}

function captchaFailedResponse(message: string) {
  return Response.json(
    { error: { code: "CAPTCHA_FAILED", message, status: 422 } },
    { status: 422 },
  );
}

export function isHoneypotFilled(body: SignupGuardBody): boolean {
  return typeof body.company_website === "string" && body.company_website.trim() !== "";
}

export function isSubmittedTooFast(body: SignupGuardBody, now = Date.now()): boolean {
  const startedAt =
    typeof body.formStartedAt === "number"
      ? body.formStartedAt
      : typeof body.formStartedAt === "string"
        ? Number(body.formStartedAt)
        : NaN;
  if (!Number.isFinite(startedAt)) return false;
  return now - startedAt < MIN_SIGNUP_FILL_MS;
}

export async function verifyTurnstile(
  token: string | undefined,
  ip: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    console.warn("[signup-guard] TURNSTILE_SECRET_KEY not set — captcha check skipped");
    return { ok: true };
  }

  if (!token?.trim()) {
    return { ok: false, message: "Please complete the security check." };
  }

  try {
    const form = new URLSearchParams({ secret, response: token.trim() });
    if (ip && ip !== "unknown") form.set("remoteip", ip);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json().catch(() => null)) as { success?: boolean } | null;
    if (data?.success === true) return { ok: true };
    return { ok: false, message: "Security check failed. Please try again." };
  } catch (error) {
    console.error("[signup-guard] Turnstile verify failed", {
      error: error instanceof Error ? error.message : error,
    });
    return { ok: false, message: "Security check is unavailable. Please try again in a moment." };
  }
}

function emailDomain(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

/** Bot checks shared by advertiser and publisher signup; run before any DB work. */
export async function runSignupGuard(
  request: Request,
  body: unknown,
): Promise<SignupGuardResult> {
  const ip = clientIpFromRequest(request);

  for (const [key, limit, windowMs] of [
    [`signup:ip:10m:${ip}`, 5, TEN_MINUTES_MS],
    [`signup:ip:1d:${ip}`, 20, ONE_DAY_MS],
  ] as const) {
    const limited = checkRateLimit(key, limit, windowMs);
    if (!limited.allowed) {
      return { ok: false, response: rateLimitResponse(limited.retryAfterSec) };
    }
  }

  const fields: SignupGuardBody =
    body && typeof body === "object" ? (body as SignupGuardBody) : {};

  if (isHoneypotFilled(fields) || isSubmittedTooFast(fields)) {
    console.warn("[signup-guard] bot-like signup dropped", { ip });
    return { ok: false, response: silentRejectResponse() };
  }

  const token = typeof fields.turnstileToken === "string" ? fields.turnstileToken : undefined;
  const captcha = await verifyTurnstile(token, ip);
  if (!captcha.ok) {
    return { ok: false, response: captchaFailedResponse(captcha.message) };
  }

  const domain = emailDomain(fields.email);
  if (domain) {
    const limited = checkRateLimit(`signup:email-domain:${domain}`, 30, ONE_HOUR_MS);
    if (!limited.allowed) {
      return { ok: false, response: rateLimitResponse(limited.retryAfterSec) };
    }
  }

  return { ok: true };
}
