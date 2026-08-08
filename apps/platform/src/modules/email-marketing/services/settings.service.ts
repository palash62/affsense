import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { PLATFORM_EMAILS } from "@/lib/email/addresses";

export async function getAdvertiserEmailSettings(advertiserId: string) {
  const [settings, user] = await Promise.all([
    prisma.advertiserEmailSettings.findUnique({ where: { advertiserId } }),
    prisma.user.findUnique({
      where: { id: advertiserId },
      include: { advertiserProfile: true },
    }),
  ]);

  return {
    fromName: settings?.fromName ?? user?.advertiserProfile?.company ?? user?.name ?? "",
    fromEmail: settings?.fromEmail ?? "",
    replyTo: settings?.replyTo ?? PLATFORM_EMAILS.support,
  };
}

export async function updateAdvertiserEmailSettings(
  advertiserId: string,
  data: { fromName?: string; fromEmail?: string; replyTo?: string },
) {
  const fromEmailRaw = data.fromEmail?.trim().toLowerCase() || null;

  if (fromEmailRaw) {
    const mailbox = await prisma.advertiserSendingMailbox.findFirst({
      where: {
        advertiserId,
        email: fromEmailRaw,
        identity: { verificationStatus: "VERIFIED" },
      },
    });
    if (!mailbox) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Default from email must be a verified sending address from Domains",
        422,
      );
    }
  }

  return prisma.advertiserEmailSettings.upsert({
    where: { advertiserId },
    create: {
      advertiserId,
      fromName: data.fromName,
      fromEmail: fromEmailRaw,
      replyTo: data.replyTo,
    },
    update: {
      fromName: data.fromName,
      ...(data.fromEmail !== undefined ? { fromEmail: fromEmailRaw } : {}),
      replyTo: data.replyTo,
    },
  });
}
