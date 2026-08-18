import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPublicRedirectUrl, getPublicRedirectOrigin } from "@/lib/platform-host";

const ENV_KEYS = [
  "AUTH_URL",
  "APP_URL",
  "PLATFORM_URL",
  "NEXT_PUBLIC_PLATFORM_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

describe("getPublicRedirectOrigin", () => {
  const snapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      snapshot[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (snapshot[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = snapshot[key];
      }
    }
  });

  it("uses AUTH_URL when request.url is the Docker listen address", () => {
    process.env.AUTH_URL = "https://leadvix.io";
    const request = new Request(
      "https://0.0.0.0:3000/api/v1/admin/impersonate/start?redirectTo=/publisher",
    );

    expect(getPublicRedirectOrigin(request)).toBe("https://leadvix.io");
    expect(buildPublicRedirectUrl(request, "/publisher").href).toBe(
      "https://leadvix.io/publisher",
    );
  });

  it("does not use 0.0.0.0 even if AUTH_URL is a listen address", () => {
    process.env.AUTH_URL = "https://0.0.0.0:3000";
    process.env.APP_URL = "https://leadvix.io";
    const request = new Request("https://0.0.0.0:3000/publisher");

    expect(buildPublicRedirectUrl(request, "/publisher").href).toBe(
      "https://leadvix.io/publisher",
    );
  });

  it("falls back to x-forwarded-host when env URLs are unset", () => {
    const request = new Request("https://0.0.0.0:3000/api/v1/admin/impersonate/start", {
      headers: {
        "x-forwarded-host": "leadvix.io",
        "x-forwarded-proto": "https",
      },
    });

    expect(buildPublicRedirectUrl(request, "/publisher").href).toBe(
      "https://leadvix.io/publisher",
    );
  });

  it("never returns 0.0.0.0 or 127.0.0.1 as the redirect host", () => {
    const request = new Request("https://0.0.0.0:3000/publisher", {
      headers: {
        "x-forwarded-host": "127.0.0.1:3000",
        "x-forwarded-proto": "https",
      },
    });

    const origin = new URL(getPublicRedirectOrigin(request));
    expect(origin.hostname).not.toBe("0.0.0.0");
    expect(origin.hostname).not.toBe("127.0.0.1");
  });
});
