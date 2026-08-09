import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { getFraudDashboardMetrics } from "@/modules/fraud";

export async function GET() {
  return withAuth(async () => {
    const data = await getFraudDashboardMetrics();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
