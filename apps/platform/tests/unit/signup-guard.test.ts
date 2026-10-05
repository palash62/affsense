import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MIN_SIGNUP_FILL_MS,
  TURNSTILE_VERIFY_URL,
  isHoneypotFilled,
  isSubmittedTooFast,
  runSignupGuard,
} from "@/lib/signup-guard";

let ipCounter = 0;

function signupRequest(ip = `10.0.0.${++ipCounter}`) {
  return new Request("http://localhost/api/v1/auth/register", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

const humanBody = () => ({
  email: `user${ipCounter}@example.com`,
  company_website: "",
  formStartedAt: Date.now() - 30_000,
  turnstileToken: "token-ok",
});

describe("signup guard helpers", () => {
  it("detects a filled honeypot", () => {
    expect(isHoneypotFilled({ company_website: "" })).toBe(false);
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled({ company_website: "https://spam.example" })).toBe(true);
  });

  it("flags submissions faster than the minimum fill time", () => {
    const now = 1_000_000;
    expect(isSubmittedTooFast({ formStartedAt: now - 500 }, now)).toBe(true);
    expect(isSubmittedTooFast({ formStartedAt: now - MIN_SIGNUP_FILL_MS }, now)).toBe(false);
    expect(isSubmittedTooFast({}, now)).toBe(false);
  });
});

describe("runSignupGuard", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("allows a normal signup when Turnstile is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const result = await runSignupGuard(signupRequest(), humanBody());
    expect(result.ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("silently drops honeypot submissions with a fake 201", async () => {
    const result = await runSignupGuard(signupRequest(), {
      ...humanBody(),
      company_website: "http://bot.example",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(201);
      const data = await result.response.json();
      expect(data.user).toBeUndefined();
    }
  });

  it("silently drops submissions made too fast", async () => {
    const result = await runSignupGuard(signupRequest(), {
      ...humanBody(),
      formStartedAt: Date.now() - 200,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(201);
  });

  it("rate limits after 5 signups from one IP in 10 minutes", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const ip = "203.0.113.50";
    for (let i = 0; i < 5; i++) {
      const ok = await runSignupGuard(signupRequest(ip), humanBody());
      expect(ok.ok).toBe(true);
    }
    const blocked = await runSignupGuard(signupRequest(ip), humanBody());
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.response.status).toBe(429);
  });

  it("passes when Turnstile verifies the token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    fetchMock.mockResolvedValue(Response.json({ success: true }));

    const result = await runSignupGuard(signupRequest("198.51.100.7"), humanBody());

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(TURNSTILE_VERIFY_URL, expect.objectContaining({ method: "POST" }));
    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("secret")).toBe("secret");
    expect(body.get("response")).toBe("token-ok");
    expect(body.get("remoteip")).toBe("198.51.100.7");
  });

  it("returns 422 CAPTCHA_FAILED when Turnstile rejects the token", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    fetchMock.mockResolvedValue(Response.json({ success: false }));

    const result = await runSignupGuard(signupRequest(), humanBody());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(422);
      const data = await result.response.json();
      expect(data.error.code).toBe("CAPTCHA_FAILED");
    }
  });

  it("requires a token when Turnstile is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    const result = await runSignupGuard(signupRequest(), { ...humanBody(), turnstileToken: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
