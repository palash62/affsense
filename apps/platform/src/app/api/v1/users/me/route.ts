import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { isAdminPortalRole } from "@/lib/admin-portal";
import {
  updateAdminPreferencesSchema,
  updateAdvertiserProfileSchema,
  updatePublisherProfileSchema,
} from "@/lib/validations";
import {
  getAdminSettings,
  getAdvertiserSettings,
  getPublisherSettings,
  updateAdminPreferences,
  updateAdvertiserProfile,
  updatePublisherProfile,
} from "@/services/user.service";

export async function GET() {
  return withAuth(async (session) => {
    if (isAdminPortalRole(session.user.role)) {
      const user = await getAdminSettings(session.user.id);
      return Response.json({ data: user });
    }
    const user =
      session.user.role === "PUBLISHER"
        ? await getPublisherSettings(session.user.id)
        : await getAdvertiserSettings(session.user.id);
    return Response.json({ data: user });
  });
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();

      if (isAdminPortalRole(session.user.role)) {
        const parsed = updateAdminPreferencesSchema.safeParse(body);
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message, status: 422 } },
            { status: 422 },
          );
        }
        const user = await updateAdminPreferences(session.user.id, parsed.data);
        return Response.json({ data: user });
      }

      if (session.user.role === "PUBLISHER") {
        const parsed = updatePublisherProfileSchema.safeParse(body);
        if (!parsed.success) {
          const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
          return Response.json(
            { error: { code: "VALIDATION_ERROR", message, status: 422 } },
            { status: 422 },
          );
        }
        const user = await updatePublisherProfile(session.user.id, {
          name: parsed.data.name,
          website: parsed.data.website || undefined,
          trafficSource: parsed.data.trafficSource,
          timezone: parsed.data.timezone,
        });
        return Response.json({ data: user });
      }

      if (session.user.role !== "ADVERTISER") {
        return Response.json(
          { error: { code: "FORBIDDEN", message: "Profile update not allowed", status: 403 } },
          { status: 403 },
        );
      }

      const parsed = updateAdvertiserProfileSchema.safeParse(body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Please check the form and try again";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const user = await updateAdvertiserProfile(session.user.id, parsed.data);
      return Response.json({ data: user });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
