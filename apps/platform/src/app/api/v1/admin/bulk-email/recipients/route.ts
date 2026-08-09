import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { listBulkEmailRecipients } from "@/services/admin.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const roleParam = searchParams.get("role");
      const role = roleParam === "PUBLISHER" ? "PUBLISHER" : "ADVERTISER";
      const result = await listBulkEmailRecipients(role);
      return Response.json(result);
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
