import { getClientIp } from "@cpl/shared";
import { NextResponse } from "next/server";
import { buildPromotionUrl } from "@/lib/promotion-attribution";
import { recordPromotionClick } from "@/services/promotion.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const promotion = await recordPromotionClick(id, {
    ip: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
  });

  if (!promotion) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const redirectUrl = buildPromotionUrl(origin, promotion);
  return NextResponse.redirect(redirectUrl, 302);
}
