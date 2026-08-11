import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { canManagePortalUsers } from "@/lib/admin-portal";
import { errorResponse, Errors } from "@/lib/errors";
import { resendAdvertiserVerificationEmail } from "@/services/admin.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withAuth(async (session) => {
    try {
      if (
        !canManagePortalUsers(
          session.user.role,
          session.user.staffMenuAccess,
          "ADVERTISER",
        )
      ) {
        return errorResponse(Errors.forbidden());
      }

      const result = await resendAdvertiserVerificationEmail(id, session.user.id);
      return Response.json({
        success: true,
        message: `Verification email sent to ${result.email}`,
        data: result,
      });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
