import { withAuth } from "@/lib/api-handler";
import { getPublisherTaskDetail } from "@/services/publisher-task-submission.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    const { id } = await params;
    const data = await getPublisherTaskDetail(id, session.user.id);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
