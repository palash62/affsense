import { cache } from "react";
import { headers, cookies } from "next/headers";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { parseViewAsCookie, shouldApplyViewAs, VIEW_AS_COOKIE } from "@/lib/view-as";
import { ADMIN_PORTAL_ROLES, isAdminPortalRole } from "@/lib/admin-portal";

export { ADMIN_PORTAL_ROLES, isAdminPortalRole };

type AppSession = Session & { viewAsMode?: boolean };

async function resolveViewAsSession(session: Session): Promise<AppSession> {
  const cookieStore = await cookies();
  const viewAs = await parseViewAsCookie(cookieStore.get(VIEW_AS_COOKIE)?.value);
  if (!viewAs) return session;

  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "";
  const referer = headerStore.get("referer");

  if (!shouldApplyViewAs(pathname, referer, viewAs.role)) {
    return session;
  }

  const viewedUser = await prisma.user.findUnique({
    where: { id: viewAs.userId },
    select: { timezone: true },
  });

  return {
    ...session,
    user: {
      id: viewAs.userId,
      email: viewAs.email,
      name: viewAs.name,
      role: viewAs.role,
      timezone: viewedUser?.timezone?.trim() || session.user.timezone || "UTC",
    },
    impersonatorId: viewAs.impersonatorId,
    viewAsMode: true,
  };
}

/** Deduplicates auth() within a single server request (layout + page). */
export const getSession = cache(async (): Promise<AppSession | null> => {
  let session: AppSession | null = null;
  try {
    session = (await auth()) as AppSession | null;
  } catch {
    // Stale or invalid JWT (e.g. AUTH_SECRET changed) — treat as logged out.
    return null;
  }
  if (!session?.user) return session;
  return resolveViewAsSession(session);
});

async function hasValidUserSession(userId: string, role: UserRole, tokenVersion?: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, tokenVersion: true },
  });

  if (!user) return false;
  if (user.role !== role) return false;
  if (user.status === "SUSPENDED") return false;
  if (typeof tokenVersion === "number" && user.tokenVersion !== tokenVersion) {
    return false;
  }
  return true;
}

/**
 * Validates the JWT identity for normal sessions and admin view-as.
 * In view-as mode, tokenVersion is checked against the admin (impersonator), not the target user.
 */
export async function isAuthorizedAppSession(session: AppSession): Promise<boolean> {
  if (!session.user) return false;

  if (session.viewAsMode && session.impersonatorId) {
    const adminOk = await hasValidUserSession(
      session.impersonatorId,
      "ADMIN",
      session.tokenVersion,
    );
    if (!adminOk) return false;
    // Target advertiser/publisher: role + status only — do not compare admin JWT tokenVersion.
    return hasValidUserSession(session.user.id, session.user.role);
  }

  return hasValidUserSession(session.user.id, session.user.role, session.tokenVersion);
}

export async function requireAuth(allowedRoles?: UserRole[]) {
  const session = await getSession();
  if (!session?.user) {
    throw Errors.invalidCredentials();
  }
  const valid = await isAuthorizedAppSession(session);
  if (!valid) {
    throw Errors.invalidCredentials();
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw Errors.forbidden();
  }
  return session;
}

/** Returns the real admin id when impersonating, otherwise the session user id for admins. */
export function getActorId(session: { user: { id: string; role: UserRole }; impersonatorId?: string }) {
  return session.impersonatorId ?? session.user.id;
}

export async function requireRealAdmin() {
  let session: Session | null = null;
  try {
    session = await auth();
  } catch {
    throw Errors.invalidCredentials();
  }
  if (!session?.user) {
    throw Errors.invalidCredentials();
  }
  if (session.user.role !== "ADMIN") {
    throw Errors.forbidden();
  }
  const valid = await hasValidUserSession(session.user.id, "ADMIN", session.tokenVersion);
  if (!valid) {
    throw Errors.invalidCredentials();
  }
  return session;
}

export async function requireApiAuth(allowedRoles?: UserRole[]) {
  const session = await getSession();
  if (!session?.user) {
    return { error: Errors.invalidCredentials(), session: null };
  }
  const valid = await isAuthorizedAppSession(session);
  if (!valid) {
    return { error: Errors.invalidCredentials(), session: null };
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    return { error: Errors.forbidden(), session: null };
  }
  return { error: null, session };
}
