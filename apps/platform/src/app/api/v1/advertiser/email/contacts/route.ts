import { withAuth, parsePagination } from "@/lib/api-handler";
import { listContacts } from "@/modules/email-marketing";
import type { EmailContactStatus } from "@prisma/client";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const search = searchParams.get("search") ?? undefined;
    const status = searchParams.get("status") as EmailContactStatus | null;
    const listId = searchParams.get("listId") ?? undefined;
    const tagId = searchParams.get("tagId") ?? undefined;
    const sourceCampaignId = searchParams.get("sourceCampaignId") ?? undefined;

    const data = await listContacts(session.user.id, {
      page,
      limit,
      search,
      status: status ?? undefined,
      listId,
      tagId,
      sourceCampaignId,
    });
    return Response.json({ data });
  }, ["ADVERTISER"]);
}
