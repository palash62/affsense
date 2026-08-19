import type { UserRole } from "@prisma/client";

/** Roles that can enter the /admin portal shell. */
export const ADMIN_PORTAL_ROLES: UserRole[] = ["ADMIN", "PLATFORM_MANAGER"];

export const STAFF_USERS_PATH = "/admin/users";

/** Top-level admin nav hrefs that may be granted to Platform Managers. */
export const ASSIGNABLE_STAFF_MENU_HREFS = [
  "/admin/profit",
  "/admin/advertisers",
  "/admin/publishers",
  "/admin/campaigns",
  "/admin/cpa-offers",
  "/admin/bulk-email",
  "/admin/leads",
  "/admin/fraud",
  "/admin/wallets",
  "/admin/deposits",
  "/admin/payouts",
  "/admin/referrals",
  "/admin/reports",
  "/admin/support",
  "/admin/settings",
  "/admin/audit-log",
  "/admin/themes",
  "/admin/funnel-templates",
  "/admin/tutorials",
] as const;

export type AssignableStaffMenuHref = (typeof ASSIGNABLE_STAFF_MENU_HREFS)[number];

export function isAdminPortalRole(role: UserRole | string | null | undefined): boolean {
  return role === "ADMIN" || role === "PLATFORM_MANAGER";
}

export function parseStaffMenuAccess(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(ASSIGNABLE_STAFF_MENU_HREFS);
  return value
    .filter((v): v is string => typeof v === "string" && allowed.has(v))
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

/** Whether a PLATFORM_MANAGER (or admin) may open this admin pathname. */
export function canAccessAdminPath(
  pathname: string,
  role: UserRole | string,
  staffMenuAccess: string[] | null | undefined,
): boolean {
  if (role === "ADMIN") return true;
  if (role !== "PLATFORM_MANAGER") return false;

  const path = pathname.split("?")[0] || pathname;
  if (path === "/admin" || path === "/admin/") return true;
  if (path === "/admin/old-menu" || path.startsWith("/admin/old-menu/")) return true;
  if (path === STAFF_USERS_PATH || path.startsWith(`${STAFF_USERS_PATH}/`)) {
    return false;
  }

  const access = parseStaffMenuAccess(staffMenuAccess);
  for (const href of access) {
    if (path === href || path.startsWith(`${href}/`)) return true;
  }

  // CPA submenu includes Global Postback as a sibling href under the CPA group.
  if (
    access.includes("/admin/cpa-offers") &&
    (path === "/admin/global-postback" || path.startsWith("/admin/global-postback/"))
  ) {
    return true;
  }

  // Legacy finance/support routes map to the new admin menu paths.
  if (
    access.includes("/admin/payouts") &&
    (path === "/admin/payout-center" || path.startsWith("/admin/payout-center/"))
  ) {
    return true;
  }
  if (
    access.includes("/admin/support") &&
    (path === "/admin/support-tickets" || path.startsWith("/admin/support-tickets/"))
  ) {
    return true;
  }

  return false;
}
