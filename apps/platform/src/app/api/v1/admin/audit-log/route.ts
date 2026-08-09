import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { listAuditLogs } from "@/services/admin.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const result = await listAuditLogs({ page, limit });
    return Response.json(result);
  }, ADMIN_PORTAL_ROLES);
}
