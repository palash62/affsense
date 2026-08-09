import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseStaffMenuAccess } from "@/lib/admin-portal";
import { authConfig } from "@/lib/auth.config";
import { getLoginBlock } from "@/lib/auth-login-gate";
import { consumeImpersonationToken } from "@/services/impersonation.service";
import { consumeLoginOtp } from "@/services/auth-token.service";
import { checkRateLimit } from "@/lib/rate-limit";

export { ROLE_ROUTES, getDashboardPath } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get?.("x-real-ip") ||
          "unknown";
        const limited = checkRateLimit(`login:${ip}`, 20, 60_000);
        if (!limited.allowed) return null;

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).trim().toLowerCase() },
        });

        if (!user) return null;

        if (user.role !== "ADMIN" && user.role !== "PLATFORM_MANAGER") return null;

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash,
        );

        if (!valid) return null;

        if (getLoginBlock(user)) return null;
        if (user.status !== "ACTIVE") return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion ?? 0,
          timezone: user.timezone ?? "UTC",
          staffMenuAccess: parseStaffMenuAccess(user.staffMenuAccess),
        };
      },
    }),
    CredentialsProvider({
      id: "otp",
      name: "otp",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.code) return null;

        const ip =
          request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get?.("x-real-ip") ||
          "unknown";
        const limited = checkRateLimit(`login-otp:${ip}`, 20, 60_000);
        if (!limited.allowed) return null;

        const user = await consumeLoginOtp(
          String(credentials.email).trim().toLowerCase(),
          String(credentials.code).trim(),
        );

        if (!user) return null;
        if (
          user.role !== "ADMIN" &&
          user.role !== "PLATFORM_MANAGER" &&
          user.role !== "ADVERTISER" &&
          user.role !== "PUBLISHER"
        ) {
          return null;
        }
        if (getLoginBlock(user)) return null;
        if (user.status !== "ACTIVE") return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tokenVersion: user.tokenVersion ?? 0,
          timezone: user.timezone ?? "UTC",
          staffMenuAccess: parseStaffMenuAccess(user.staffMenuAccess),
        };
      },
    }),
    CredentialsProvider({
      id: "impersonation",
      name: "impersonation",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const result = await consumeImpersonationToken(String(credentials.token));
        if (!result) return null;

        return {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          tokenVersion: result.user.tokenVersion ?? 0,
          timezone: result.user.timezone ?? "UTC",
          staffMenuAccess: [],
          impersonatorId: result.impersonatorId,
        };
      },
    }),
  ],
});
