import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { adminPromotionReportQuerySchema } from "@/lib/validations";
import { getAdminPromotionReport } from "@/services/promotion.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const parsed = adminPromotionReportQuerySchema.safeParse({
      q: searchParams.get("q") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    const options = parsed.success ? parsed.data : {};
    const data = await getAdminPromotionReport(options);
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
