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
import { getAssignableStaffMenuOptions, getNavForRole } from "@/components/layout/nav-config";

describe("admin portal roles", () => {
  it("treats ADMIN and PLATFORM_MANAGER as portal roles", () => {
    expect(isAdminPortalRole("ADMIN")).toBe(true);
    expect(isAdminPortalRole("PLATFORM_MANAGER")).toBe(true);
    expect(isAdminPortalRole("ADVERTISER")).toBe(false);
    expect(ADMIN_PORTAL_ROLES).toEqual(["ADMIN", "PLATFORM_MANAGER"]);
  });

  it("filters menu access to assignable hrefs and normalizes legacy keys", () => {
    expect(
      parseStaffMenuAccess([
        "/admin/digital-products",
        "/admin/users",
        "/evil",
        "/admin/digital-products",
        123,
      ]),
    ).toEqual(["/admin/digital-products"]);

    expect(parseStaffMenuAccess(["/admin/payouts", "/admin/support", "/admin/cpa-offers"])).toEqual([
      "/admin/support-tickets",
      "/admin/offer-network",
    ]);
  });

  it("drops removed promotion grants and maps legacy support", () => {
    expect(parseStaffMenuAccess(["/admin/promotion", "/admin/promotions", "/admin/banners"])).toEqual(
      [],
    );
    expect(parseStaffMenuAccess(["/admin/support"])).toEqual(["/admin/support-tickets"]);
    expect(canAccessAdminPath("/admin/promotions", "PLATFORM_MANAGER", ["/admin/promotion"])).toBe(
      false,
    );
    expect(canAccessAdminPath("/admin/support-tickets", "PLATFORM_MANAGER", ["/admin/support"])).toBe(
      true,
    );
  });

  it("lets admins open every admin path", () => {
    expect(canAccessAdminPath("/admin/users", "ADMIN", [])).toBe(true);
    expect(canAccessAdminPath("/admin/digital-products", "ADMIN", [])).toBe(true);
  });

  it("always allows managers dashboard and blocks Users menu", () => {
    expect(canAccessAdminPath("/admin", "PLATFORM_MANAGER", [])).toBe(true);
    expect(
      canAccessAdminPath(STAFF_USERS_PATH, "PLATFORM_MANAGER", ["/admin/digital-products"]),
    ).toBe(false);
  });

  it("grants managers assigned Affsense menus including nested CPA paths", () => {
    const menus = ["/admin/digital-products", "/admin/offer-network"];
    expect(canAccessAdminPath("/admin/digital-products", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/digital-products/new", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/profit", "PLATFORM_MANAGER", menus)).toBe(false);
    expect(canAccessAdminPath("/admin/offer-network", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/cpa-offers/offers", "PLATFORM_MANAGER", menus)).toBe(true);
    expect(canAccessAdminPath("/admin/global-postback", "PLATFORM_MANAGER", menus)).toBe(true);
  });

  it("grants support-tickets for current and legacy menu keys", () => {
    expect(
      canAccessAdminPath("/admin/support-tickets", "PLATFORM_MANAGER", ["/admin/support-tickets"]),
    ).toBe(true);
    expect(canAccessAdminPath("/admin/support-tickets", "PLATFORM_MANAGER", ["/admin/support"])).toBe(
      true,
    );
    expect(
      canAccessAdminPath("/admin/payout-center", "PLATFORM_MANAGER", ["/admin/payout-center"]),
    ).toBe(false);
  });

  it("exposes assignable options matching Affsense nav without Manager", () => {
    const options = getAssignableStaffMenuOptions();
    const hrefs = options.map((o) => o.href);
    expect(hrefs).toContain("/admin/publishers");
    expect(hrefs).toContain("/admin/advertisers");
    expect(hrefs).toContain("/admin/digital-products");
    expect(hrefs).toContain("/admin/offer-network");
    expect(hrefs).toContain("/admin/invoices");
    expect(hrefs).toContain("/admin/support-tickets");
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/banners");
    expect(hrefs).not.toContain("/admin/wallets");
    expect(hrefs).not.toContain("/admin/payout-center");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin");
    expect(options.find((o) => o.href === "/admin/publishers")?.label).toBe("Affiliates");
  });

  it("filters PLATFORM_MANAGER nav to granted Affsense menus and excludes Users", () => {
    const nav = getNavForRole("PLATFORM_MANAGER", {
      staffMenuAccess: ["/admin/digital-products", "/admin/themes"],
    });
    const hrefs = nav.flatMap((entry) => {
      if (entry.kind === "item") {
        return [entry.item.href, ...(entry.item.children?.map((child) => child.href) ?? [])];
      }
      return [];
    });
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/admin/digital-products");
    expect(hrefs).toContain("/admin/themes");
    expect(hrefs).not.toContain("/admin/users");
    expect(hrefs).not.toContain("/admin/profit");
  });

  it("keeps full admin nav including invoices and support", () => {
    const hrefs = getNavForRole("ADMIN").flatMap((entry) =>
      entry.kind === "item" ? [entry.item.href] : [],
    );
    expect(hrefs).toContain("/admin/invoices");
    expect(hrefs).toContain("/admin/support-tickets");
    expect(hrefs).not.toContain("/admin/promotions");
    expect(hrefs).not.toContain("/admin/banners");
    expect(hrefs).not.toContain("/admin/wallets");
    expect(hrefs).not.toContain("/admin/payout-center");
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
    expect(
      canImpersonateUser("PLATFORM_MANAGER", ["/admin/digital-products"], "PUBLISHER"),
    ).toBe(false);
    expect(canImpersonateUser("PLATFORM_MANAGER", [], "PUBLISHER")).toBe(false);
  });

  it("denies impersonation for non-portal actors", () => {
    expect(canImpersonateUser("ADVERTISER", ["/admin/publishers"], "PUBLISHER")).toBe(false);
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
    expect(
      canManagePortalUsers("PLATFORM_MANAGER", ["/admin/digital-products"], "PUBLISHER"),
    ).toBe(false);
    expect(canManagePortalUsers("PLATFORM_MANAGER", [], "ADVERTISER")).toBe(false);
  });
});
