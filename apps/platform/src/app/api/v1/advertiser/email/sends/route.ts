import { withAuth, parsePagination } from "@/lib/api-handler";
import { listSends } from "@/modules/email-marketing";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const status = searchParams.get("status") ?? undefined;
    const search = searchParams.get("search") ?? undefined;
    const data = await listSends(session.user.id, { page, limit, status, search });
    return Response.json({ data });
  }, ["ADVERTISER"]);
}
