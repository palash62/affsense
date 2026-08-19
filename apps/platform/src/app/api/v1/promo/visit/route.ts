import { errorResponse } from "@/lib/errors";
import {
  checkRateLimit,
  clientIpFromRequest,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { promotionVisitSchema } from "@/lib/validations";
import { recordPromotionVisit } from "@/services/promotion.service";

export async function POST(request: Request) {
  const ip = clientIpFromRequest(request);
  const limited = checkRateLimit(`promo-visit:${ip}`, 30, 60_000);
  if (!limited.allowed) {
    return rateLimitResponse(limited.retryAfterSec);
  }

  try {
    const body = await request.json();
    const parsed = promotionVisitSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid visit payload";
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message, status: 422 } },
        { status: 422 },
      );
    }

    const userAgent = request.headers.get("user-agent") ?? "";
    const referrer = request.headers.get("referer");
    await recordPromotionVisit(parsed.data, { ip, userAgent, referrer });

    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
