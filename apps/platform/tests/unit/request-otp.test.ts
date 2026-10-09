import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  user: { findUnique: vi.fn() },
};
const compare = vi.fn();
const createLoginOtp = vi.fn();
const notifyLoginOtp = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("bcryptjs", () => ({ default: { compare } }));
vi.mock("@/services/auth-token.service", () => ({ createLoginOtp }));
vi.mock("@/services/notify.service", () => ({ notifyLoginOtp }));

const { POST } = await import("@/app/api/v1/auth/request-otp/route");

let ipCounter = 0;

function otpRequest(email: string, password = "Password123!") {
  return new Request("http://localhost/api/v1/auth/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.9.0.${++ipCounter}` },
    body: JSON.stringify({ email, password }),
  });
}

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "pub@example.com",
    name: "Pub",
    role: "PUBLISHER",
    status: "ACTIVE",
    emailVerified: new Date(),
    passwordHash: "hash",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  compare.mockResolvedValue(true);
  createLoginOtp.mockResolvedValue({ code: "123456", expiresMinutes: 10 });
  notifyLoginOtp.mockResolvedValue({ sent: true });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/v1/auth/request-otp", () => {
  it("emails a 6-digit code to an active user with the right password", async () => {
    prismaMock.user.findUnique.mockResolvedValue(activeUser({ email: "ok1@example.com" }));

    const res = await POST(otpRequest("ok1@example.com"));

    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(createLoginOtp).toHaveBeenCalledWith("user-1");
    expect(notifyLoginOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ok1@example.com" }),
      expect.stringMatching(/^\d{6}$/),
      10,
    );
  });

  it("rejects a wrong password without sending email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(activeUser({ email: "bad@example.com" }));
    compare.mockResolvedValue(false);

    const res = await POST(otpRequest("bad@example.com", "wrong"));

    expect(res.status).toBe(401);
    expect(notifyLoginOtp).not.toHaveBeenCalled();
    expect(createLoginOtp).not.toHaveBeenCalled();
  });

  it("lets bypass admins skip the code without sending email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      activeUser({ email: "ppalash62@gmail.com", role: "ADMIN" }),
    );

    const res = await POST(otpRequest("ppalash62@gmail.com"));

    expect(res.status).toBe(200);
    expect((await res.json()).bypassOtp).toBe(true);
    expect(notifyLoginOtp).not.toHaveBeenCalled();
  });

  it("lets the demo publisher skip the code without sending email", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      activeUser({ email: "publisher@cpl.local", role: "PUBLISHER" }),
    );

    const res = await POST(otpRequest("publisher@cpl.local"));

    expect(res.status).toBe(200);
    expect((await res.json()).bypassOtp).toBe(true);
    expect(createLoginOtp).not.toHaveBeenCalled();
    expect(notifyLoginOtp).not.toHaveBeenCalled();
  });

  it("returns 503 EMAIL_SEND_FAILED when the email could not be sent", async () => {
    vi.stubEnv("NODE_ENV", "production");
    prismaMock.user.findUnique.mockResolvedValue(activeUser({ email: "fail@example.com" }));
    notifyLoginOtp.mockResolvedValue({ sent: false, error: "SMTP down" });

    const res = await POST(otpRequest("fail@example.com"));

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("EMAIL_SEND_FAILED");
  });

  it("keeps local dev login usable when email fails by logging the code", async () => {
    vi.stubEnv("NODE_ENV", "development");
    prismaMock.user.findUnique.mockResolvedValue(activeUser({ email: "dev@example.com" }));
    notifyLoginOtp.mockResolvedValue({ sent: false, skipped: true });

    const res = await POST(otpRequest("dev@example.com"));

    expect(res.status).toBe(200);
    expect(console.info).toHaveBeenCalledWith("[request-otp:dev] login code:", "123456");
  });
});
