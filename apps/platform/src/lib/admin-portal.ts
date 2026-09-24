import type { UserRole } from "@prisma/client";

/** Roles that can enter the /admin portal shell. */
export const ADMIN_PORTAL_ROLES: UserRole[] = ["ADMIN", "PLATFORM_MANAGER"];

export const STAFF_USERS_PATH = "/admin/users";

/** Top-level Affsense admin nav hrefs that may be granted to Platform Managers. */
export const ASSIGNABLE_STAFF_MENU_HREFS = [
  "/admin/publishers",
  "/admin/advertisers",
  "/admin/digital-products",
  "/admin/get-paid-tasks",
  "/admin/offer-wall",
  "/admin/offer-network",
  "/admin/commissions",
  "/admin/invoices",
  "/admin/support-tickets",
  "/admin/bulk-email",
  "/admin/announcements",
  "/admin/settings",
  "/admin/system-logs",
  "/admin/themes",
] as const;

export type AssignableStaffMenuHref = (typeof ASSIGNABLE_STAFF_MENU_HREFS)[number];

/** Legacy keys previously stored in staffMenuAccess → current assignable hrefs. */
const LEGACY_STAFF_MENU_HREF_MAP: Record<string, AssignableStaffMenuHref> = {
  "/admin/support": "/admin/support-tickets",
  "/admin/cpa-offers": "/admin/offer-network",
  "/admin/referrals": "/admin/commissions",
};

const ASSIGNABLE_SET = new Set<string>(ASSIGNABLE_STAFF_MENU_HREFS);

export function isAdminPortalRole(role: UserRole | string | null | undefined): boolean {
  return role === "ADMIN" || role === "PLATFORM_MANAGER";
}

export function parseStaffMenuAccess(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const mapped = LEGACY_STAFF_MENU_HREF_MAP[v] ?? v;
    if (!ASSIGNABLE_SET.has(mapped)) continue;
    if (!normalized.includes(mapped)) normalized.push(mapped);
  }
  return normalized;
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

  // CPA Offers grant covers legacy CPA admin routes and global postback.
  if (access.includes("/admin/offer-network")) {
    if (
      path === "/admin/cpa-offers" ||
      path.startsWith("/admin/cpa-offers/") ||
      path === "/admin/global-postback" ||
      path.startsWith("/admin/global-postback/")
    ) {
      return true;
    }
  }

  // Commissions grant covers referrals.
  if (
    access.includes("/admin/commissions") &&
    (path === "/admin/referrals" || path.startsWith("/admin/referrals/"))
  ) {
    return true;
  }

  return false;
}

/**
 * Whether an admin-portal actor may create/update/delete publishers or advertisers.
 * Managers need the matching Publishers/Advertisers menu; admins always may.
 */
export function canManagePortalUsers(
  actorRole: UserRole | string,
  staffMenuAccess: string[] | null | undefined,
  targetRole: UserRole | string,
): boolean {
  if (targetRole !== "PUBLISHER" && targetRole !== "ADVERTISER") return false;
  if (actorRole === "ADMIN") return true;
  if (actorRole !== "PLATFORM_MANAGER") return false;

  const access = parseStaffMenuAccess(staffMenuAccess);
  if (targetRole === "PUBLISHER") return access.includes("/admin/publishers");
  return access.includes("/admin/advertisers");
}

/**
 * Whether an admin-portal actor may start view-as (Login) for a target user role.
 * Same menu rules as create/status/delete for publishers and advertisers.
 */
export function canImpersonateUser(
  actorRole: UserRole | string,
  staffMenuAccess: string[] | null | undefined,
  targetRole: UserRole | string,
): boolean {
  return canManagePortalUsers(actorRole, staffMenuAccess, targetRole);
}
