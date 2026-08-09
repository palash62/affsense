import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  getCpaDashboardSnapshot,
  type CpaDashboardRange,
} from "@/services/cpa-offer.service";

const RANGES: CpaDashboardRange[] = ["today", "yesterday", "last7d", "thisMonth", "lastMonth"];

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const raw = searchParams.get("range") ?? "last7d";
      const range = (RANGES.includes(raw as CpaDashboardRange) ? raw : "last7d") as CpaDashboardRange;
      const data = await getCpaDashboardSnapshot(range);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
