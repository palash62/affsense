import { withAuth, parsePagination } from "@/lib/api-handler";
import {
  PUBLISHER_GET_PAID_TASKS_ENABLED,
  publisherGetPaidTasksDisabledResponse,
} from "@/lib/feature-flags";
import { listPublisherTasksWithSubmissions } from "@/services/publisher-task-submission.service";

export async function GET(request: Request) {
  if (!PUBLISHER_GET_PAID_TASKS_ENABLED) return publisherGetPaidTasksDisabledResponse();
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const showOnDashboard = searchParams.get("showOnDashboard");
    const data = await listPublisherTasksWithSubmissions(session.user.id, {
      activeOnly: true,
      showOnDashboard: showOnDashboard === "true" ? true : undefined,
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page,
      limit,
    });
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
