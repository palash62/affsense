import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  notifyAccountActivated,
  notifyAdminAlert,
} from "@/services/notify.service";

const LOGIN_OTP_TTL_MS = 10 * 60 * 1000;
const LOGIN_OTP_MAX_ATTEMPTS = 5;

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function createOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createPasswordResetToken(userId: string) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export async function consumePasswordResetToken(token: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.user;
}

export async function createEmailVerificationToken(userId: string) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.emailVerificationToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export type VerifiedUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
};

export async function consumeEmailVerificationToken(token: string): Promise<VerifiedUser | null> {
  const record = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, status: true },
      },
    },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  const activateAdvertiser = record.user.role === "ADVERTISER";
  const verifiedAt = new Date();

  const user = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: verifiedAt },
    });

    return tx.user.update({
      where: { id: record.userId },
      data: {
        emailVerified: verifiedAt,
        ...(activateAdvertiser ? { status: "ACTIVE" } : {}),
      },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
  });

  void (async () => {
    if (user.role === "ADVERTISER" && user.status === "ACTIVE") {
      await notifyAccountActivated(user);
      return;
    }

    if (user.role === "PUBLISHER") {
      await notifyAdminAlert({
        title: "Publisher email verified",
        message: `${user.name} (${user.email}) verified their email and is awaiting admin approval.`,
        actionPath: "/admin/publishers",
        metadata: { userId: user.id, role: user.role },
      });
    }
  })();

  return user;
}

export async function createLoginOtp(userId: string) {
  const code = createOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + LOGIN_OTP_TTL_MS);

  await prisma.loginOtpToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.loginOtpToken.create({
    data: { userId, codeHash, expiresAt },
  });

  return { code, expiresMinutes: LOGIN_OTP_TTL_MS / 60_000 };
}

export type LoginOtpUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  tokenVersion: number;
  emailVerified: Date | null;
  timezone: string;
  staffMenuAccess: unknown;
};

async function findActiveLoginOtp(userId: string) {
  return prisma.loginOtpToken.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function validateLoginOtp(
  email: string,
  code: string,
  consume: boolean,
): Promise<LoginOtpUser | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      tokenVersion: true,
      emailVerified: true,
      timezone: true,
      staffMenuAccess: true,
    },
  });

  if (
    !user ||
    (user.role !== "ADMIN" &&
      user.role !== "PLATFORM_MANAGER" &&
      user.role !== "ADVERTISER" &&
      user.role !== "PUBLISHER")
  ) {
    return null;
  }

  const record = await findActiveLoginOtp(user.id);
  if (!record) return null;

  if (record.attempts >= LOGIN_OTP_MAX_ATTEMPTS) {
    if (consume) {
      await prisma.loginOtpToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    }
    return null;
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    if (consume) {
      await prisma.loginOtpToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
    }
    return null;
  }

  if (consume) {
    await prisma.loginOtpToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
  }

  return user;
}

export async function checkLoginOtp(email: string, code: string) {
  return validateLoginOtp(email, code, false);
}

export async function consumeLoginOtp(email: string, code: string) {
  return validateLoginOtp(email, code, true);
}
