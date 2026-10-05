import { beforeEach, describe, expect, it, vi } from "vitest";

const isMailgunConfiguredMock = vi.fn();
const getMailgunConfigMock = vi.fn();
const getResolvedEmailConfigMock = vi.fn();
const getTransporterForConfigMock = vi.fn();

vi.mock("@/lib/email/mailgun", () => ({
  isMailgunConfigured: () => isMailgunConfiguredMock(),
  getMailgunConfig: () => getMailgunConfigMock(),
  sendViaMailgun: vi.fn(),
}));

vi.mock("@/services/smtp-settings.service", () => ({
  getResolvedEmailConfig: () => getResolvedEmailConfigMock(),
}));

vi.mock("@/lib/email/transport", () => ({
  getTransporterForConfig: (config: unknown) => getTransporterForConfigMock(config),
  resetEmailTransport: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: { create: vi.fn() },
    user: { findFirst: vi.fn() },
  },
}));

describe("getEmailProviderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMailgunConfiguredMock.mockReturnValue(false);
    getResolvedEmailConfigMock.mockResolvedValue({
      enabled: false,
      source: "none",
      host: undefined,
      port: 587,
      secure: false,
      from: "test@example.com",
      appUrl: "http://localhost:3010",
    });
    getTransporterForConfigMock.mockReturnValue(null);
  });

  it("returns mailgun when Mailgun env is configured", async () => {
    isMailgunConfiguredMock.mockReturnValue(true);

    const { getEmailProviderStatus } = await import("@/services/email.service");
    const status = await getEmailProviderStatus();

    expect(status).toEqual({
      provider: "mailgun",
      source: "environment",
      configured: true,
    });
  });

  it("returns smtp with database source when SMTP transport is available", async () => {
    getResolvedEmailConfigMock.mockResolvedValue({
      enabled: true,
      source: "database",
      host: "smtp.example.com",
      port: 587,
      secure: false,
      from: "noreply@example.com",
      appUrl: "https://affsense.com",
    });
    getTransporterForConfigMock.mockReturnValue({ sendMail: vi.fn() });

    const { getEmailProviderStatus } = await import("@/services/email.service");
    const status = await getEmailProviderStatus();

    expect(status).toEqual({
      provider: "smtp",
      source: "database",
      configured: true,
    });
  });

  it("returns none when no provider is configured", async () => {
    const { getEmailProviderStatus } = await import("@/services/email.service");
    const status = await getEmailProviderStatus();

    expect(status).toEqual({
      provider: "none",
      source: "none",
      configured: false,
    });
  });
});

describe("register emailDelivery", () => {
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.doMock("@/lib/prisma", () => ({ prisma: prismaMock }));
    vi.doMock("bcryptjs", () => ({
      default: { hash: vi.fn().mockResolvedValue("hashed") },
    }));
    vi.doMock("@/lib/signup-email", () => ({
      validateSignupEmail: vi.fn().mockResolvedValue({ ok: true }),
    }));
    vi.doMock("@/services/referral.service", () => ({
      resolveReferrerId: vi.fn().mockResolvedValue(null),
    }));
    vi.doMock("@/services/auth-token.service", () => ({
      createEmailVerificationToken: vi.fn().mockResolvedValue("test-verify-token"),
    }));
    vi.doMock("@/services/smtp-settings.service", () => ({
      getResolvedEmailConfig: vi.fn().mockResolvedValue({ appUrl: "http://localhost:3010" }),
    }));
    vi.doMock("@/services/notify.service", () => ({
      notifyWelcome: vi.fn().mockResolvedValue({ sent: false, skipped: true }),
      notifyEmailVerification: vi.fn().mockResolvedValue({ sent: false, skipped: true }),
      notifyReferralSignup: vi.fn(),
    }));

    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({
      id: "user-1",
      email: "adv@example.com",
      name: "Test Advertiser",
      role: "ADVERTISER",
      status: "PENDING",
    });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
  });

  it("returns emailDelivery.skipped when verification email is not sent", async () => {
    const { POST } = await import("@/app/api/v1/auth/register/route");

    const response = await POST(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Advertiser",
          email: "adv@example.com",
          password: "Password123!",
          phone: "555-0100",
          address: "123 Main St",
          country: "US",
        }),
      }),
    );

    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.emailDelivery).toEqual({
      verificationSent: false,
      welcomeSent: false,
      skipped: true,
    });
  });
});
