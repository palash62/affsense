import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  deleteGetPaidTaskCategory,
  listGetPaidTaskCategories,
  saveGetPaidTaskCategory,
} from "@/services/get-paid-task.service";

export async function GET() {
  return withAuth(async () => {
    const data = await listGetPaidTaskCategories();
    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const data = await saveGetPaidTaskCategory(body);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "id required", status: 422 } },
          { status: 422 },
        );
      }
      const data = await deleteGetPaidTaskCategory(id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
