import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

const authMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());
const headersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // Avoid cross-test memoization from React cache() in getSession.
    cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

process.env.AUTH_SECRET = "test-secret-at-least-16-chars";

import { createViewAsCookieValue } from "@/lib/view-as";
import { isAuthorizedAppSession, requireApiAuth } from "@/lib/session";

describe("view-as session tokenVersion auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows view-as when admin JWT tokenVersion matches admin but not advertiser DB", async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "admin_1") {
        return { id: "admin_1", role: "ADMIN", status: "ACTIVE", tokenVersion: 0 };
      }
      if (where.id === "adv_1") {
        return { id: "adv_1", role: "ADVERTISER", status: "ACTIVE", tokenVersion: 5 };
      }
      return null;
    });

    const ok = await isAuthorizedAppSession({
      user: {
        id: "adv_1",
        email: "advertiser@cpl.local",
        name: "Advertiser",
        role: "ADVERTISER",
        timezone: "UTC",
      },
      tokenVersion: 0,
      viewAsMode: true,
      impersonatorId: "admin_1",
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(ok).toBe(true);
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rejects normal advertiser session when JWT tokenVersion mismatches DB", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: "adv_1",
      role: "ADVERTISER",
      status: "ACTIVE",
      tokenVersion: 5,
    });

    const ok = await isAuthorizedAppSession({
      user: {
        id: "adv_1",
        email: "advertiser@cpl.local",
        name: "Advertiser",
        role: "ADVERTISER",
        timezone: "UTC",
      },
      tokenVersion: 0,
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(ok).toBe(false);
  });

  it("requireApiAuth allows view-as advertiser with mismatched advertiser tokenVersion", async () => {
    const cookie = await createViewAsCookieValue(
      {
        id: "adv_1",
        email: "advertiser@cpl.local",
        name: "Advertiser",
        role: "ADVERTISER",
      },
      "admin_1",
    );

    authMock.mockResolvedValue({
      user: {
        id: "admin_1",
        email: "admin@cpl.local",
        name: "Admin",
        role: "ADMIN",
      },
      tokenVersion: 0,
      expires: new Date(Date.now() + 60_000).toISOString(),
    });

    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === "cpl-view-as" ? { value: cookie } : undefined),
    });
    headersMock.mockResolvedValue({
      get: (name: string) => {
        if (name === "x-pathname") return "/advertiser/optin-funnels";
        if (name === "referer") return null;
        return null;
      },
    });

    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === "admin_1") {
        return { id: "admin_1", role: "ADMIN", status: "ACTIVE", tokenVersion: 0 };
      }
      if (where.id === "adv_1") {
        return { id: "adv_1", role: "ADVERTISER", status: "ACTIVE", tokenVersion: 5 };
      }
      return null;
    });

    const result = await requireApiAuth(["ADVERTISER"]);

    expect(result.error).toBeNull();
    expect(result.session?.user.id).toBe("adv_1");
    expect(result.session?.user.role).toBe("ADVERTISER");
    expect(result.session?.viewAsMode).toBe(true);
  });

  it("requireApiAuth rejects normal advertiser JWT when tokenVersion mismatches", async () => {
    authMock.mockResolvedValue({
      user: {
        id: "adv_1",
        email: "advertiser@cpl.local",
        name: "Advertiser",
        role: "ADVERTISER",
      },
      tokenVersion: 0,
      expires: new Date(Date.now() + 60_000).toISOString(),
    });
    cookiesMock.mockResolvedValue({ get: () => undefined });
    headersMock.mockResolvedValue({ get: () => null });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "adv_1",
      role: "ADVERTISER",
      status: "ACTIVE",
      tokenVersion: 5,
    });

    const result = await requireApiAuth(["ADVERTISER"]);

    expect(result.session).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
