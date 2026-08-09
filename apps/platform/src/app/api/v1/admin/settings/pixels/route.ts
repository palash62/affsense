import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { platformPixelSettingsSchema } from "@/lib/validations";
import {
  getPlatformPixelSettingsForAdmin,
  updatePlatformPixelSettings,
} from "@/services/platform-pixel-settings.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getPlatformPixelSettingsForAdmin();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = platformPixelSettingsSchema.safeParse(body);

      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message ?? "Please check the form and try again";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const data = await updatePlatformPixelSettings(parsed.data, session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
