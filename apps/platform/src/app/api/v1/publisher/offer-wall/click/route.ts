import { headers } from "next/headers";
import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { recordOfferWallClick } from "@/services/offer-wall-report.service";

const bodySchema = z.object({
  offerId: z.string().trim().min(1),
  offerName: z.string().trim().optional().nullable(),
  trackingUrl: z.string().trim().url(),
  subId: z.string().trim().optional().nullable(),
  src: z.string().trim().optional().nullable(),
});

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const json = await request.json().catch(() => ({}));
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid body",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const h = await headers();
      const forwarded = h.get("x-forwarded-for");
      const ip =
        forwarded?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        null;
      const userAgent = h.get("user-agent");

      const data = await recordOfferWallClick({
        publisherId: session.user.id,
        offerId: parsed.data.offerId,
        offerName: parsed.data.offerName,
        trackingUrl: parsed.data.trackingUrl,
        subId: parsed.data.subId,
        src: parsed.data.src,
        ip,
        userAgent,
      });

      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
