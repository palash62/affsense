import { withRealAdmin } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { adminUpdateStaffUserSchema } from "@/lib/validations";
import { updatePlatformManager } from "@/services/admin.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return withRealAdmin(async () => {
    try {
      const { id } = await params;
      const body = await request.json();
      const parsed = adminUpdateStaffUserSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid input",
              status: 422,
            },
          },
          { status: 422 },
        );
      }
      const data = await updatePlatformManager(id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  });
}
