import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { createGetPaidTask, listGetPaidTasks } from "@/services/get-paid-task.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const data = await listGetPaidTasks({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page,
      limit,
    });
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = await createGetPaidTask(body);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
