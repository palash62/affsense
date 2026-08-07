import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailBroadcastSchema } from "@/lib/validations";
import { getBroadcast, updateBroadcast } from "@/modules/email-marketing";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  return withAuth(async (session) => {
    try {
      const { id } = await context.params;
      const data = await getBroadcast(session.user.id, id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}

export async function PATCH(request: Request, context: Ctx) {
  return withAuth(async (session) => {
    try {
      const { id } = await context.params;
      const body = await request.json();
      const parsed = emailBroadcastSchema.safeParse(body);
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
      const data = await updateBroadcast(session.user.id, id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
