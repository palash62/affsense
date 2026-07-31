import { withAuth } from "@/lib/api-handler";
import { listEmailLists } from "@/modules/email-marketing";

/** @deprecated Prefer GET /api/v1/advertiser/email/lists */
export async function GET() {
  return withAuth(async (session) => {
    const data = await listEmailLists(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}
