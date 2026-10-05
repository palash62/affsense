import { withAuth } from "@/lib/api-handler";
import {
  PUBLISHER_GET_PAID_TASKS_ENABLED,
  publisherGetPaidTasksDisabledResponse,
} from "@/lib/feature-flags";
import { getPublisherTaskDetail } from "@/services/publisher-task-submission.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!PUBLISHER_GET_PAID_TASKS_ENABLED) return publisherGetPaidTasksDisabledResponse();
  return withAuth(async (session) => {
    const { id } = await params;
    const data = await getPublisherTaskDetail(id, session.user.id);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
