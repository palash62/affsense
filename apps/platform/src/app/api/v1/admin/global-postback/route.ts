import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { adminCpaNetworkPostbackSchema } from "@/lib/validations";
import {
  getCpaNetworkPostbackSettings,
  updateCpaNetworkPostbackSettings,
} from "@/services/cpa-network-postback.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getCpaNetworkPostbackSettings();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json();
    const parsed = adminCpaNetworkPostbackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    const data = await updateCpaNetworkPostbackSettings(parsed.data, session.user.id);
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
