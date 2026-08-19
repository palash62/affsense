import { errorResponse } from "@/lib/errors";
import { clientIpFromRequest } from "@/lib/rate-limit";
import { recordPromotionClick } from "@/services/promotion.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const origin = `${url.protocol}//${url.host}`;
    const ip = clientIpFromRequest(request);
    const userAgent = request.headers.get("user-agent") ?? "";
    const referrer = request.headers.get("referer");

    const redirectUrl = await recordPromotionClick(
      id,
      { ip, userAgent, referrer },
      origin,
    );

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    return errorResponse(error);
  }
}
