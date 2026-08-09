import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { getAdminBulkEmailReport } from "@/services/admin.service";

export async function GET() {
  return withAuth(async () => {
    const data = await getAdminBulkEmailReport();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
