import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { listClickFunnelsProducts } from "@/services/clickfunnels-api.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const refresh = new URL(request.url).searchParams.get("refresh") === "1";
      const data = await listClickFunnelsProducts({ refresh });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
