import { describe, expect, it } from "vitest";
import {
  ADMIN_PORTAL_ROLES,
  canAccessAdminPath,
  canImpersonateUser,
  canManagePortalUsers,
  isAdminPortalRole,
  parseStaffMenuAccess,
  STAFF_USERS_PATH,
} from "@/lib/admin-portal";
import { getNavForRole } from "@/components/layout/nav-config";

describe("admin portal roles", () => {
  it("treats ADMIN and PLATFORM_MANAGER as portal roles", () => {
    expect(isAdminPortalRole("ADMIN")).toBe(true);
    expect(isAdminPortalRole("PLATFORM_MANAGER")).toBe(true);
    expect(isAdminPortalRole("ADVERTISER")).toBe(false);
    expect(ADMIN_PORTAL_ROLES).toEqual(["ADMIN", "PLATFORM_MANAGER"]);
  });

  it("filters menu access to assignable hrefs only", () => {
    expect(
      parseStaffMenuAccess([
        "/admin/leads",
        "/admin/users",
        "/evil",
        "/admin/leads",
        123,
      ]),
    ).toEqual(["/admin/leads"]);
  });

  it("lets admins open every admin path", () => {
    expect(canAccessAdminPath("/admin/users", "ADMIN", [])).toBe(true);
    expect(canAccessAdminPath("/admin/profit", "ADMIN", [])).toBe(true);
  });

  it("always allows managers dashboard and blocks Users menu", () => {
    expect(canAccessAdminPath("/admin", "PLATFORM_MANAGER", [])).toBe(true);
    expect(canAccessAdminPath(STAFF_USERS_PATH, "PLATFORM_MANAGER", ["/admin/leads"])).toBe(
      false,
    );
  });

  it("grants managers only assigned menus including nested CPA paths", () => {
    const menus = ["/admin/leads", "/admin/cpa-offers"];
    expect(canAccessAdminPath("/admin/leads", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/leads/foo", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/profit", "PLATFORM_MANAGER", menus)).toBe(false);
    expect(canAccessAdminPath("/admin/cpa-offers/offers", "PLATFORM_MANAGER", menus)).toBe(
      true,
    );
    expect(canAccessAdminPath("/admin/global-postback", "PLATFORM_MANAGER", menus)).toBe(
      true,
    );
  });

  it("filters PLATFORM_MANAGER nav to granted menus and excludes Users", () => {
    const nav = getNavForRole("PLATFORM_MANAGER", {
      staffMenuAccess: ["/admin/leads", "/admin/support"],
    });
    const hrefs = nav.map((item) => item.href);
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/leads");
    expect(hrefs).toContain("/admin/support");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/profit");
  });

  it("keeps full admin nav including Users", () => {
    const hrefs = getNavForRole("ADMIN").map((item) => item.href);
    expect(hrefs).toContain("/admin/users");
    expect(hrefs).toContain("/admin/advertisers");
  });

  it("lets admins impersonate publishers and advertisers", () => {
    expect(canImpersonateUser("ADMIN", [], "PUBLISHER")).toBe(true);
    expect(canImpersonateUser("ADMIN", [], "ADVERTISER")).toBe(true);
    expect(canImpersonateUser("ADMIN", [], "ADMIN")).toBe(false);
  });

  it("lets managers impersonate only when matching menu is granted", () => {
    expect(
      canImpersonateUser("PLATFORM_MANAGER", ["/admin/publishers"], "PUBLISHER"),
    ).toBe(true);
    expect(
      canImpersonateUser("PLATFORM_MANAGER", ["/admin/publishers"], "ADVERTISER"),
    ).toBe(false);
    expect(
      canImpersonateUser("PLATFORM_MANAGER", ["/admin/advertisers"], "ADVERTISER"),
    ).toBe(true);
    expect(
      canImpersonateUser("PLATFORM_MANAGER", ["/admin/advertisers"], "PUBLISHER"),
    ).toBe(false);
    expect(canImpersonateUser("PLATFORM_MANAGER", ["/admin/leads"], "PUBLISHER")).toBe(
      false,
    );
    expect(canImpersonateUser("PLATFORM_MANAGER", [], "PUBLISHER")).toBe(false);
  });

  it("denies impersonation for non-portal actors", () => {
    expect(canImpersonateUser("ADVERTISER", ["/admin/publishers"], "PUBLISHER")).toBe(
      false,
    );
    expect(canImpersonateUser("PUBLISHER", [], "ADVERTISER")).toBe(false);
  });

  it("lets admins manage publishers and advertisers", () => {
    expect(canManagePortalUsers("ADMIN", [], "PUBLISHER")).toBe(true);
    expect(canManagePortalUsers("ADMIN", [], "ADVERTISER")).toBe(true);
    expect(canManagePortalUsers("ADMIN", [], "ADMIN")).toBe(false);
    expect(canManagePortalUsers("ADMIN", [], "PLATFORM_MANAGER")).toBe(false);
  });

  it("lets managers manage users only when matching menu is granted", () => {
    expect(
      canManagePortalUsers("PLATFORM_MANAGER", ["/admin/publishers"], "PUBLISHER"),
    ).toBe(true);
    expect(
      canManagePortalUsers("PLATFORM_MANAGER", ["/admin/publishers"], "ADVERTISER"),
    ).toBe(false);
    expect(
      canManagePortalUsers("PLATFORM_MANAGER", ["/admin/advertisers"], "ADVERTISER"),
    ).toBe(true);
    expect(
      canManagePortalUsers("PLATFORM_MANAGER", ["/admin/advertisers"], "PUBLISHER"),
    ).toBe(false);
    expect(canManagePortalUsers("PLATFORM_MANAGER", ["/admin/leads"], "PUBLISHER")).toBe(
      false,
    );
    expect(canManagePortalUsers("PLATFORM_MANAGER", [], "ADVERTISER")).toBe(false);
  });
});
