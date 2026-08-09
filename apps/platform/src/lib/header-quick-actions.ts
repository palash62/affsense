import type { UserRole } from "@prisma/client";
import { isAdminPortalRole } from "@/lib/admin-portal";

export function shouldShowAdminQuickActions(role: UserRole) {
  return role === "ADMIN";
}

export function adminPortalHomeHref(role: UserRole) {
  return isAdminPortalRole(role) ? "/admin" : null;
}
