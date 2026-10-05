import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = { $queryRaw: vi.fn() };
const validateEmailDeliverability = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email-deliverability", () => ({ validateEmailDeliverability }));

const { canonicalGmailLocal, isDisposableEmailDomain, validateSignupEmail } = await import(
  "@/lib/signup-email"
);

beforeEach(() => {
  vi.clearAllMocks();
  validateEmailDeliverability.mockResolvedValue({ ok: true });
  prismaMock.$queryRaw.mockResolvedValue([]);
});

describe("signup email helpers", () => {
  it("canonicalizes gmail dot and plus aliases", () => {
    expect(canonicalGmailLocal("J.o.h.n+promo@Gmail.com")).toBe("john");
    expect(canonicalGmailLocal("john@googlemail.com")).toBe("john");
    expect(canonicalGmailLocal("j.ohn@example.com")).toBeNull();
  });

  it("detects disposable domains", () => {
    expect(isDisposableEmailDomain("x@mailinator.com")).toBe(true);
    expect(isDisposableEmailDomain("x@1secmail.com")).toBe(true);
    expect(isDisposableEmailDomain("x@gmail.com")).toBe(false);
  });
});

describe("validateSignupEmail", () => {
  it("rejects disposable email without calling the provider", async () => {
    const result = await validateSignupEmail("bot@yopmail.com");
    expect(result.ok).toBe(false);
    expect(validateEmailDeliverability).not.toHaveBeenCalled();
  });

  it("passes through deliverability failures", async () => {
    validateEmailDeliverability.mockResolvedValue({ ok: false, reason: "bad" });
    await expect(validateSignupEmail("x@example.com")).resolves.toEqual({ ok: false, reason: "bad" });
  });

  it("rejects a gmail alias of an existing account", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "u1" }]);
    const result = await validateSignupEmail("j.ohn+1@gmail.com");
    expect(result.ok).toBe(false);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("does not query aliases for non-gmail domains", async () => {
    await expect(validateSignupEmail("someone@example.com")).resolves.toEqual({ ok: true });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("accepts a new gmail address", async () => {
    await expect(validateSignupEmail("fresh.person@gmail.com")).resolves.toEqual({ ok: true });
  });
});
