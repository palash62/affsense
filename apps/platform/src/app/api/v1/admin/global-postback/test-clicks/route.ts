import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { listRecentCpaTestClicks } from "@/services/cpa-global-postback-test.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10", 10);
    const data = await listRecentCpaTestClicks(limit);
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
