import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  getOgadsOfferWallSettingsForAdmin,
  updateOgadsOfferWallSettings,
} from "@/services/ogads-offer-wall-settings.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getOgadsOfferWallSettingsForAdmin();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const data = await updateOgadsOfferWallSettings(
        {
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
          endpoint: typeof body.endpoint === "string" ? body.endpoint : undefined,
          max: typeof body.max === "number" ? body.max : undefined,
          affiliatePercent:
            typeof body.affiliatePercent === "number" ? body.affiliatePercent : undefined,
          postbackSecret:
            typeof body.postbackSecret === "string" ? body.postbackSecret : undefined,
          regenerateSecret: body.regenerateSecret === true,
        },
        session.user.id,
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
