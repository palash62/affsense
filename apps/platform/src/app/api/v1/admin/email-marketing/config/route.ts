import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailMarketingPlatformConfigSchema } from "@/lib/validations";
import {
  getEmailMarketingPlatformConfig,
  updateEmailMarketingPlatformConfig,
} from "@/modules/email-marketing/services/email-marketing-config.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getEmailMarketingPlatformConfig();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailMarketingPlatformConfigSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
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

      const data = await updateEmailMarketingPlatformConfig(parsed.data, session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
