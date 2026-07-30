import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { ROLE_ROUTES } from "@/lib/auth.config";
import type { UserRole } from "@prisma/client";

const TOKEN_TTL_MS = 60_000;

/** In-memory one-time use tracking (valid for single-server dev/staging). */
const usedTokenIds = new Set<string>();

type TokenPurpose = "IMPERSONATE" | "RESTORE";

type SignedTokenPayload = {
  purpose: TokenPurpose;
  adminId: string;
  targetUserId: string;
  exp: number;
  jti: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new AppError(
      "CONFIG_ERROR",
      "AUTH_SECRET is not configured",
      500,
    );
  }
  return secret;
}

function signPayload(payload: SignedTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySignedToken(token: string): SignedTokenPayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");

  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SignedTokenPayload;

    if (!payload.jti || !payload.adminId || !payload.targetUserId || !payload.purpose) {
      return null;
    }
    if (payload.exp < Date.now()) return null;
    if (usedTokenIds.has(payload.jti)) return null;

    usedTokenIds.add(payload.jti);
    return payload;
  } catch {
    return null;
  }
}

async function loadTargetUser(targetUserId: string) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, name: true, role: true, status: true, tokenVersion: true, timezone: true },
  });
}

export async function createImpersonationToken(adminId: string, targetUserId: string) {
  const target = await loadTargetUser(targetUserId);

  if (!target) {
    throw new AppError("USER_NOT_FOUND", "User not found", 404);
  }

  if (target.status !== "ACTIVE" && target.status !== "PENDING") {
    throw new AppError("USER_NOT_ACTIVE", "Only active or pending accounts can be impersonated", 422);
  }

  if (target.role !== "ADVERTISER" && target.role !== "PUBLISHER") {
    throw new AppError("USER_INVALID_ROLE", "Can only impersonate advertisers or publishers", 422);
  }

  const token = signPayload({
    purpose: "IMPERSONATE",
    adminId,
    targetUserId,
    exp: Date.now() + TOKEN_TTL_MS,
    jti: crypto.randomBytes(16).toString("hex"),
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "user.impersonation_started",
      entityType: "user",
      entityId: targetUserId,
      metadata: { targetRole: target.role, targetName: target.name },
    },
  });

  return {
    token,
    redirectTo: ROLE_ROUTES[target.role as UserRole],
  };
}

export async function createRestoreToken(adminId: string) {
  const admin = await prisma.user.findUnique({
    where: { id: adminId },
    select: { id: true, role: true, status: true },
  });

  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
    throw new AppError("PERMISSION_DENIED", "Invalid admin session", 403);
  }

  const token = signPayload({
    purpose: "RESTORE",
    adminId,
    targetUserId: adminId,
    exp: Date.now() + TOKEN_TTL_MS,
    jti: crypto.randomBytes(16).toString("hex"),
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "user.impersonation_stopped",
      entityType: "user",
      entityId: adminId,
    },
  });

  return { token, redirectTo: ROLE_ROUTES.ADMIN };
}

export async function consumeImpersonationToken(tokenId: string) {
  const payload = verifySignedToken(tokenId);
  if (!payload) return null;

  if (payload.purpose === "RESTORE") {
    const admin = await loadTargetUser(payload.adminId);
    if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
      return null;
    }
    return {
      purpose: "RESTORE" as const,
      adminId: payload.adminId,
      user: admin,
      impersonatorId: undefined,
    };
  }

  const target = await loadTargetUser(payload.targetUserId);
  if (!target) return null;

  if (target.status !== "ACTIVE" && target.status !== "PENDING") {
    return null;
  }

  if (target.role !== "ADVERTISER" && target.role !== "PUBLISHER") {
    return null;
  }

  return {
    purpose: "IMPERSONATE" as const,
    adminId: payload.adminId,
    user: target,
    impersonatorId: payload.adminId,
  };
}
