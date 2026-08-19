import type { UserRole } from "@prisma/client";
import { canAccessAdminPath, isAdminPortalRole } from "@/lib/admin-portal";

export function shouldShowAdminQuickActions(role: UserRole) {
  return isAdminPortalRole(role);
}

export function filterAdminQuickActionLinks<T extends { href: string }>(
  links: T[],
  role: UserRole,
  staffMenuAccess: string[] | null | undefined,
): T[] {
  return links.filter((link) => canAccessAdminPath(link.href, role, staffMenuAccess));
}

export function adminPortalHomeHref(role: UserRole) {
  return isAdminPortalRole(role) ? "/admin" : null;
}
