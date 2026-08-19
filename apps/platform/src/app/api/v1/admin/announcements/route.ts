import { ADMIN_PORTAL_ROLES, withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { announcementSchema } from "@/lib/validations";
import {
  createAnnouncement,
  listAnnouncementsForAdmin,
} from "@/services/announcement.service";

export async function GET() {
  return withAuth(async () => {
    const data = await listAnnouncementsForAdmin();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const parsed = announcementSchema.safeParse(body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid announcement data";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const data = await createAnnouncement(parsed.data);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
