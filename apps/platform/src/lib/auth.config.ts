import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { parseViewAsCookie, VIEW_AS_COOKIE } from "@/lib/view-as";
import { isPublicPreviewRequest } from "@/lib/public-preview-paths";
import {
  canAccessAdminPath,
  isAdminPortalRole,
  parseStaffMenuAccess,
} from "@/lib/admin-portal";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      timezone: string;
      staffMenuAccess?: string[];
    };
    impersonatorId?: string;
    viewAsMode?: boolean;
    tokenVersion?: number;
  }
  interface User {
    role: UserRole;
    impersonatorId?: string;
    tokenVersion?: number;
    timezone?: string;
    staffMenuAccess?: string[];
  }
}

export const ROLE_ROUTES: Record<UserRole, string> = {
  ADMIN: "/admin",
  PLATFORM_MANAGER: "/admin",
  ADVERTISER: "/advertiser",
  PUBLISHER: "/publisher",
};

export function getDashboardPath(role: UserRole): string {
  return ROLE_ROUTES[role];
}

const publicPaths = [
  "/login",
  "/register",
  "/register/publisher",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/api/v1/auth/register",
  "/api/v1/auth/register/publisher",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/resend-verification",
  "/api/v1/auth/credentials-check",
  "/api/v1/auth/request-otp",
  "/api/v1/auth/otp-check",
  "/o/",
  "/p/",
  "/domains/",
  "/api/v1/leads/submit-optin",
  "/api/v1/leads/submit-landing",
  "/api/v1/funnel-events",
  "/api/internal/",
  "/api/v1/email/track/",
  "/api/v1/webhooks/mailgun",
  "/unsubscribe/",
  "/api/v1/admin/impersonate/start",
  "/api/v1/admin/impersonate/stop",
  "/api/auth",
];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.email = user.email;
        token.name = user.name;
        token.tokenVersion = user.tokenVersion ?? 0;
        token.timezone = user.timezone ?? "UTC";
        token.staffMenuAccess = parseStaffMenuAccess(user.staffMenuAccess);
        if (user.impersonatorId) {
          token.impersonatorId = user.impersonatorId;
        } else {
          delete token.impersonatorId;
        }
      }
      // Allow client/server to refresh timezone after settings save via update()
      if (trigger === "update" && session && typeof session === "object") {
        const next = session as {
          timezone?: string;
          name?: string;
          staffMenuAccess?: string[];
        };
        if (typeof next.timezone === "string" && next.timezone.trim()) {
          token.timezone = next.timezone.trim();
        }
        if (typeof next.name === "string" && next.name.trim()) {
          token.name = next.name.trim();
        }
        if (Array.isArray(next.staffMenuAccess)) {
          token.staffMenuAccess = parseStaffMenuAccess(next.staffMenuAccess);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.timezone =
          typeof token.timezone === "string" && token.timezone.trim()
            ? token.timezone
            : "UTC";
        session.user.staffMenuAccess = parseStaffMenuAccess(token.staffMenuAccess);
        session.tokenVersion = typeof token.tokenVersion === "number" ? token.tokenVersion : 0;
        if (token.impersonatorId) {
          session.impersonatorId = token.impersonatorId as string;
        } else {
          delete session.impersonatorId;
        }
      }
      return session;
    },
    async authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const preview = request.nextUrl.searchParams.get("preview");
      const viewAs = await parseViewAsCookie(request.cookies.get(VIEW_AS_COOKIE)?.value);

      if (isPublicPreviewRequest(pathname, preview)) {
        return true;
      }

      const guestOnlyPaths = [
        "/login",
        "/register",
        "/register/publisher",
        "/forgot-password",
      ];

      if (
        auth?.user?.role &&
        guestOnlyPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
      ) {
        return Response.redirect(
          new URL(ROLE_ROUTES[auth.user.role], request.nextUrl),
        );
      }

      if (
        publicPaths.some((p) => pathname.startsWith(p)) ||
        pathname === "/" ||
        pathname.startsWith("/_next") ||
        pathname.includes(".")
      ) {
        return true;
      }

      // API routes enforce auth themselves and return JSON errors.
      if (pathname.startsWith("/api/")) {
        return true;
      }

      const viewAsPublisher =
        viewAs?.role === "PUBLISHER" &&
        (pathname.startsWith("/publisher") ||
          (pathname.startsWith("/api/v1/") &&
            (request.headers.get("referer")?.includes("/publisher") ?? false)));
      const viewAsAdvertiser =
        viewAs?.role === "ADVERTISER" &&
        (pathname.startsWith("/advertiser") ||
          (pathname.startsWith("/api/v1/") &&
            (request.headers.get("referer")?.includes("/advertiser") ?? false)));

      if (!auth?.user && !viewAsPublisher && !viewAsAdvertiser) {
        return false;
      }

      if (pathname.startsWith("/admin")) {
        const role = auth?.user?.role;
        if (!role || !isAdminPortalRole(role)) {
          const fallback = role ?? viewAs?.role ?? "ADVERTISER";
          return Response.redirect(new URL(ROLE_ROUTES[fallback as UserRole], request.nextUrl));
        }
        if (
          !canAccessAdminPath(
            pathname,
            role,
            auth.user.staffMenuAccess,
          )
        ) {
          return Response.redirect(new URL("/admin", request.nextUrl));
        }
        return true;
      }

      if (pathname.startsWith("/advertiser")) {
        if (viewAs?.role === "ADVERTISER" || auth?.user?.role === "ADVERTISER") {
          return true;
        }
        if (auth?.user?.role) {
          return Response.redirect(new URL(ROLE_ROUTES[auth.user.role], request.nextUrl));
        }
        return false;
      }

      if (pathname.startsWith("/publisher")) {
        if (viewAs?.role === "PUBLISHER" || auth?.user?.role === "PUBLISHER") {
          return true;
        }
        if (auth?.user?.role) {
          return Response.redirect(new URL(ROLE_ROUTES[auth.user.role], request.nextUrl));
        }
        return false;
      }

      if (pathname === "/dashboard") {
        const role = viewAs?.role ?? auth?.user?.role ?? "ADVERTISER";
        return Response.redirect(new URL(ROLE_ROUTES[role as UserRole], request.nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
