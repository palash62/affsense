import bcrypt from "bcryptjs";
import { errorResponse } from "@/lib/errors";
import { getLoginBlock, loginBlockMessage } from "@/lib/auth-login-gate";
import { prisma } from "@/lib/prisma";
import { requestOtpSchema } from "@/lib/validations";
import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { canBypassAdminOtp } from "@/lib/admin-otp-bypass";
import { createLoginOtp } from "@/services/auth-token.service";
import { notifyLoginOtp } from "@/services/notify.service";

const GENERIC_MESSAGE = "Check your email for your 6-digit sign-in code.";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);

  try {
    const body = await request.json();
    const parsed = requestOtpSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid email or password", status: 422 } },
        { status: 422 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();

    const emailLimited = checkRateLimit(`request-otp:email:${email}`, 5, 15 * 60_000);
    if (!emailLimited.allowed) {
      return rateLimitResponse(emailLimited.retryAfterSec);
    }

    const ipLimited = checkRateLimit(`request-otp:ip:${ip}`, 20, 15 * 60_000);
    if (!ipLimited.allowed) {
      return rateLimitResponse(ipLimited.retryAfterSec);
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        emailVerified: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return Response.json(
        { error: { code: "AUTH_INVALID", message: "Invalid email or password", status: 401 } },
        { status: 401 },
      );
    }

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return Response.json(
        { error: { code: "AUTH_INVALID", message: "Invalid email or password", status: 401 } },
        { status: 401 },
      );
    }

    const block = getLoginBlock(user);
    if (block) {
      return Response.json(
        {
          error: {
            code: block.toUpperCase(),
            message: loginBlockMessage(block),
            status: 403,
          },
        },
        { status: 403 },
      );
    }

    if (user.status !== "ACTIVE") {
      return Response.json(
        { error: { code: "AUTH_INVALID", message: "Invalid email or password", status: 401 } },
        { status: 401 },
      );
    }

    if (canBypassAdminOtp(user)) {
      return Response.json({
        success: true,
        bypassOtp: true,
        message: "Signing you in...",
      });
    }

    const { code, expiresMinutes } = await createLoginOtp(user.id);
    await notifyLoginOtp(user, code, expiresMinutes);

    return Response.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    return errorResponse(error);
  }
}
