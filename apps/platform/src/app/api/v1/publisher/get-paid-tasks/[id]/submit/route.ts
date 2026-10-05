import { withAuth } from "@/lib/api-handler";
import {
  PUBLISHER_GET_PAID_TASKS_ENABLED,
  publisherGetPaidTasksDisabledResponse,
} from "@/lib/feature-flags";
import { submitPublisherTask } from "@/services/publisher-task-submission.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!PUBLISHER_GET_PAID_TASKS_ENABLED) return publisherGetPaidTasksDisabledResponse();
  return withAuth(async (session) => {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { proofUrl?: string };
    const data = await submitPublisherTask(id, session.user.id, {
      proofUrl: body.proofUrl,
    });
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
