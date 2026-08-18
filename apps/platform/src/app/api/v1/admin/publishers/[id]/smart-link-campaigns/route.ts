import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminPublisherSmartLinkCampaignsSchema } from "@/lib/validations";
import { updatePublisherSmartLinkCampaigns } from "@/services/admin.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminPublisherSmartLinkCampaignsSchema.safeParse(body);

      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid campaign selection";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const data = await updatePublisherSmartLinkCampaigns(id, parsed.data, session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
