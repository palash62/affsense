import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  getAffiliateInvoicingSettingsForAdmin,
  updateAffiliateInvoicingSettings,
} from "@/services/affiliate-invoicing-settings.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getAffiliateInvoicingSettingsForAdmin();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const data = await updateAffiliateInvoicingSettings(
        {
          enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
          minimumAmount:
            typeof body.minimumAmount === "number" ? body.minimumAmount : undefined,
          netTermDays: typeof body.netTermDays === "number" ? body.netTermDays : undefined,
          timezone: typeof body.timezone === "string" ? body.timezone : undefined,
          startAt: typeof body.startAt === "string" ? body.startAt : undefined,
        },
        session.user.id,
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
