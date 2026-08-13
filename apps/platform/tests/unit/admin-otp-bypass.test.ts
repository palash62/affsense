import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env.ADMIN_OTP_BYPASS_EMAILS;

async function loadBypassModule() {
  vi.resetModules();
  return import("@/lib/admin-otp-bypass");
}

describe("admin otp bypass", () => {
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.ADMIN_OTP_BYPASS_EMAILS;
    } else {
      process.env.ADMIN_OTP_BYPASS_EMAILS = ORIGINAL_ENV;
    }
    vi.resetModules();
  });

  it("allows bypass for allowlisted ADMIN email", async () => {
    const { canBypassAdminOtp } = await loadBypassModule();

    expect(
      canBypassAdminOtp({ email: "ppalash62@gmail.com", role: "ADMIN" }),
    ).toBe(true);
    expect(
      canBypassAdminOtp({ email: "affsensellc@gmail.com", role: "ADMIN" }),
    ).toBe(true);
  });

  it("denies bypass for allowlisted email with non-ADMIN role", async () => {
    const { canBypassAdminOtp } = await loadBypassModule();

    expect(
      canBypassAdminOtp({ email: "ppalash62@gmail.com", role: "PUBLISHER" }),
    ).toBe(false);
    expect(
      canBypassAdminOtp({ email: "ppalash62@gmail.com", role: "PLATFORM_MANAGER" }),
    ).toBe(false);
  });

  it("denies bypass for other ADMIN email", async () => {
    const { canBypassAdminOtp } = await loadBypassModule();

    expect(
      canBypassAdminOtp({ email: "other-admin@example.com", role: "ADMIN" }),
    ).toBe(false);
  });

  it("reads custom allowlist from env", async () => {
    process.env.ADMIN_OTP_BYPASS_EMAILS = "custom-admin@example.com";
    const { isAdminOtpBypassEmail } = await loadBypassModule();

    expect(isAdminOtpBypassEmail("custom-admin@example.com")).toBe(true);
    expect(isAdminOtpBypassEmail("ppalash62@gmail.com")).toBe(false);
  });
});
