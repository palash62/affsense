import { getClientIp } from "@cpl/shared";
import { NextResponse } from "next/server";
import { promotionVisitSchema } from "@/lib/validations";
import { recordPromotionVisit } from "@/services/promotion.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = promotionVisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid input",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    await recordPromotionVisit(
      {
        utmSource: parsed.data.utmSource,
        utmMedium: parsed.data.utmMedium,
        utmCampaign: parsed.data.utmCampaign,
        utmContent: parsed.data.utmContent,
        utmTerm: parsed.data.utmTerm,
        landingUrl: parsed.data.landingUrl,
      },
      {
        ip: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent"),
        referrer: request.headers.get("referer"),
        visitorKey: parsed.data.visitorKey,
        landingPath: parsed.data.landingPath,
        landingUrl: parsed.data.landingUrl,
      },
    );

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
