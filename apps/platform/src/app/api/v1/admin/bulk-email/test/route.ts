import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminBulkEmailTestSchema } from "@/lib/validations";
import { sendAdminBulkEmailTest } from "@/services/admin.service";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminBulkEmailTestSchema.safeParse(body);

      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid test email request";
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message, status: 422 } },
          { status: 422 },
        );
      }

      const result = await sendAdminBulkEmailTest({
        ...parsed.data,
        actorId: session.user.id,
      });

      return Response.json({
        data: result,
        message: `Test email sent to ${result.to}`,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
