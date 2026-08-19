import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { errorResponse } from "@/lib/errors";
import { validateEmailDeliverability } from "@/lib/email-deliverability";
import { resolveReferrerId } from "@/services/referral.service";
import { applySignupAttribution } from "@/services/promotion.service";
import { createEmailVerificationToken } from "@/services/auth-token.service";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";
import {
  notifyEmailVerification,
  notifyReferralSignup,
  notifyWelcome,
} from "@/services/notify.service";
import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = checkRateLimit(`register:${ip}`, 8, 60_000);
  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSec);
  }

  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Password does not meet security requirements";
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message, status: 422 } },
        { status: 422 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();
    const deliverability = await validateEmailDeliverability(email);
    if (!deliverability.ok) {
      return Response.json(
        { error: { code: "VALIDATION_INVALID_EMAIL", message: deliverability.reason, status: 422 } },
        { status: 422 },
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return Response.json(
        { error: { code: "AUTH_EMAIL_EXISTS", message: "Email already registered", status: 422 } },
        { status: 422 },
      );
    }

    const referredById = await resolveReferrerId(parsed.data.referralRef);
    const attribution = await applySignupAttribution(parsed.data.signupAttribution);
    const role = "ADVERTISER" as const;
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: parsed.data.name,
          role,
          status: "PENDING",
          referredById: referredById ?? undefined,
          promotionId: attribution.promotionId ?? undefined,
          signupUtmSource: attribution.signupUtmSource,
          signupUtmMedium: attribution.signupUtmMedium,
          signupUtmCampaign: attribution.signupUtmCampaign,
          signupUtmContent: attribution.signupUtmContent,
          signupUtmTerm: attribution.signupUtmTerm,
          signupLandingUrl: attribution.signupLandingUrl,
          wallet: { create: {} },
          advertiserProfile: {
            create: {
              company: parsed.data.name,
              billingInfo: {
                phone: parsed.data.phone,
                address: parsed.data.address,
                country: parsed.data.country,
              },
            },
          },
        },
      });

      return created;
    });

    const welcome = await notifyWelcome({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    if (!welcome.sent) {
      console.error("[register:email] welcome failed", {
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
      console.error("[register:email] verification failed", {
        userId: user.id,
        skipped: verification.skipped,
        error: verification.error,
      });
    }

    if (process.env.NODE_ENV === "development" && verification.skipped) {
      const config = await getResolvedEmailConfig();
      const verifyUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`;
      console.info("[register:dev] Email skipped — verification link:", verifyUrl);
    }

    const emailDelivery = {
      verificationSent: verification.sent,
      welcomeSent: welcome.sent,
      ...(verification.skipped || welcome.skipped ? { skipped: true } : {}),
      ...(verification.error || welcome.error
        ? { error: verification.error ?? welcome.error }
        : {}),
    };

    if (referredById) {
      void (async () => {
        try {
          const referrer = await prisma.user.findUnique({
            where: { id: referredById },
            select: { id: true, email: true, name: true },
          });
          if (referrer) {
            await notifyReferralSignup(referrer, { name: user.name, email: user.email });
          }
        } catch (error) {
          console.error("[register:email] referral notification failed", {
            userId: user.id,
            error: error instanceof Error ? error.message : error,
          });
        }
      })();
    }

    return Response.json(
      {
        user: { id: user.id, email: user.email, role: user.role, status: user.status },
        message: "Check your email to verify and activate your account.",
        emailDelivery,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
