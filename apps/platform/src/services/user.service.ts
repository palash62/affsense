import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { isValidTimezone, resolveUserTimezone } from "@/lib/user-timezone";
import bcrypt from "bcryptjs";
import { notifyPasswordChanged } from "@/services/notify.service";

function assertTimezone(timezone: string) {
  if (!isValidTimezone(timezone)) {
    throw new AppError("VALIDATION_ERROR", "Invalid timezone", 422);
  }
  return timezone.trim();
}

export async function getAdminSettings(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      timezone: true,
      createdAt: true,
    },
  });
}

export async function getAdvertiserSettings(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      timezone: true,
      referralCode: true,
      createdAt: true,
      advertiserProfile: {
        select: { company: true, industry: true },
      },
    },
  });
}

export async function getPublisherSettings(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      timezone: true,
      createdAt: true,
      publisherProfile: {
        select: {
          website: true,
          trafficSource: true,
          globalLinkUrl: true,
          kycStatus: true,
          rejectionReason: true,
          rejectedAt: true,
        },
      },
      wallet: { select: { balance: true } },
      _count: { select: { leads: true } },
    },
  });
}

export async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return resolveUserTimezone(user?.timezone);
}

export async function updateAdminPreferences(
  userId: string,
  data: { timezone: string },
) {
  const timezone = assertTimezone(data.timezone);
  await prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
  return getAdminSettings(userId);
}

export async function updatePublisherProfile(
  userId: string,
  data: { name: string; website?: string; trafficSource?: string; timezone?: string },
) {
  const timezone = data.timezone !== undefined ? assertTimezone(data.timezone) : undefined;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        ...(timezone ? { timezone } : {}),
      },
    });

    await tx.publisherProfile.upsert({
      where: { userId },
      create: {
        userId,
        website: data.website || null,
        trafficSource: data.trafficSource || null,
      },
      update: {
        website: data.website || null,
        trafficSource: data.trafficSource || null,
      },
    });

    return getPublisherSettings(userId);
  });
}

export async function updatePublisherGlobalLink(
  userId: string,
  globalLinkUrl: string | null,
) {
  await prisma.publisherProfile.upsert({
    where: { userId },
    create: { userId, globalLinkUrl },
    update: { globalLinkUrl },
  });

  return getPublisherSettings(userId);
}

export async function updateAdvertiserProfile(
  userId: string,
  data: { name: string; company?: string; timezone?: string },
) {
  const timezone = data.timezone !== undefined ? assertTimezone(data.timezone) : undefined;

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        ...(timezone ? { timezone } : {}),
      },
    });

    if (data.company !== undefined) {
      await tx.advertiserProfile.upsert({
        where: { userId },
        create: { userId, company: data.company },
        update: { company: data.company },
      });
    }

    return getAdvertiserSettings(userId);
  });
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw Errors.notFound("User");
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AppError("AUTH_INVALID_PASSWORD", "Current password is incorrect", 422);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
    },
    select: { id: true, email: true, name: true },
  });

  void notifyPasswordChanged(updated);
}

export async function resetUserPasswordWithToken(token: string, newPassword: string) {
  const { consumePasswordResetToken } = await import("@/services/auth-token.service");
  const user = await consumePasswordResetToken(token);
  if (!user) {
    throw new AppError("AUTH_INVALID_TOKEN", "This reset link is invalid or has expired", 422);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      tokenVersion: { increment: 1 },
    },
    select: { id: true, email: true, name: true },
  });

  void notifyPasswordChanged(updated);
  return updated;
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, status: true },
  });

  if (!user || user.status === "SUSPENDED") {
    return;
  }

  const { createPasswordResetToken } = await import("@/services/auth-token.service");
  const { notifyPasswordReset } = await import("@/services/notify.service");
  const token = await createPasswordResetToken(user.id);
  await notifyPasswordReset(user, token);
}
