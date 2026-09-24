import bcrypt from "bcryptjs";
import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { validateEmailDeliverability } from "@/lib/email-deliverability";
import type { publisherRegisterSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken } from "@/services/auth-token.service";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";
import {
  notifyAdminAlert,
  notifyEmailVerification,
  notifyWelcome,
} from "@/services/notify.service";

type PublisherRegisterInput = z.infer<typeof publisherRegisterSchema>;

async function resolvePublisherReferrerId(referralRef?: string | null) {
  if (!referralRef?.trim()) return null;

  const ref = referralRef.trim();
  const byCode = await prisma.user.findUnique({
    where: { referralCode: ref.toUpperCase() },
    select: { id: true, role: true },
  });
  if (byCode?.role === "PUBLISHER") return byCode.id;

  const byId = await prisma.user.findUnique({
    where: { id: ref },
    select: { id: true, role: true },
  });
  return byId?.role === "PUBLISHER" ? byId.id : null;
}

export async function registerPublisherAccount(data: PublisherRegisterInput) {
  const email = data.email.trim().toLowerCase();
  const username = data.username.trim().toLowerCase();
  const deliverability = await validateEmailDeliverability(email);
  if (!deliverability.ok) {
    throw new AppError("VALIDATION_INVALID_EMAIL", deliverability.reason, 422);
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("AUTH_EMAIL_EXISTS", "Email already registered", 422);
  }

  const usernameTaken = await prisma.publisherProfile.findUnique({
    where: { username },
    select: { id: true },
  });
  if (usernameTaken) {
    throw new AppError("AUTH_USERNAME_EXISTS", "Username is already taken", 422);
  }

  const referredById = await resolvePublisherReferrerId(data.referralRef);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const trafficMethods = data.applicationProfile?.trafficMethods ?? [];
  const trafficSource =
    data.trafficSource?.trim() ||
    (trafficMethods.length > 0 ? trafficMethods.join(", ") : undefined);
  const phone =
    data.phone?.trim() || data.applicationProfile?.whatsapp?.trim() || undefined;

  const applicationProfile = data.applicationProfile
    ? {
        heardFrom: data.applicationProfile.heardFrom,
        experience: data.applicationProfile.experience,
        promotionGoal: data.applicationProfile.promotionGoal,
        trafficMethods,
        currentNetworks: data.applicationProfile.currentNetworks?.trim() || null,
        monthlyTraffic: data.applicationProfile.monthlyTraffic?.trim() || null,
        promotionPlan: data.applicationProfile.promotionPlan,
        telegram: data.applicationProfile.telegram?.trim() || null,
        whatsapp: data.applicationProfile.whatsapp?.trim() || null,
        facebookUrl: data.applicationProfile.facebookUrl?.trim() || null,
      }
    : undefined;

  const user = await prisma.$transaction(async (tx) => {
    return tx.user.create({
      data: {
        email,
        passwordHash,
        name: data.name.trim(),
        role: "PUBLISHER",
        status: "PENDING",
        country: data.country?.trim() || undefined,
        phone,
        referredById: referredById ?? undefined,
        wallet: { create: {} },
        publisherProfile: {
          create: {
            username,
            website: data.website?.trim() || undefined,
            trafficSource,
            applicationProfile,
            country: data.country?.trim() || undefined,
            addressLine1: data.addressLine1?.trim() || undefined,
            addressLine2: data.addressLine2?.trim() || undefined,
            city: data.city?.trim() || undefined,
            state: data.state?.trim() || undefined,
            postalCode: data.postalCode?.trim() || undefined,
          },
        },
      },
    });
  });

  const welcome = await notifyWelcome({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  if (!welcome.sent) {
    console.error("[register:publisher] welcome failed", {
      userId: user.id,
      skipped: welcome.skipped,
      error: welcome.error,
    });
  }

  const verifyToken = await createEmailVerificationToken(user.id);
  const verification = await notifyEmailVerification(
    { id: user.id, email: user.email, name: user.name },
    verifyToken,
  );
  if (!verification.sent) {
    console.error("[register:publisher] verification failed", {
      userId: user.id,
      skipped: verification.skipped,
      error: verification.error,
    });
  }

  if (process.env.NODE_ENV === "development" && verification.skipped) {
    const config = await getResolvedEmailConfig();
    const verifyUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`;
    console.info("[register:publisher:dev] Email skipped — verification link:", verifyUrl);
  }

  void notifyAdminAlert({
    title: "New publisher application",
    message: `${user.name} (${user.email}) signed up as a publisher and is awaiting email verification.`,
    actionPath: "/admin/publishers",
    metadata: { userId: user.id, role: user.role, username },
  });

  const emailDelivery = {
    verificationSent: verification.sent,
    welcomeSent: welcome.sent,
    ...(verification.skipped || welcome.skipped ? { skipped: true } : {}),
    ...(verification.error || welcome.error
      ? { error: verification.error ?? welcome.error }
      : {}),
  };

  return { user, emailDelivery };
}
