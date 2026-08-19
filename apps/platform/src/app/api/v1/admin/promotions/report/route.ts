import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { getAdminPromotionReport } from "@/services/promotion.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if (from && Number.isNaN(from.getTime())) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid from date", status: 422 } },
        { status: 422 },
      );
    }
    if (to && Number.isNaN(to.getTime())) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid to date", status: 422 } },
        { status: 422 },
      );
    }

    const data = await getAdminPromotionReport({ q, from, to });
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
