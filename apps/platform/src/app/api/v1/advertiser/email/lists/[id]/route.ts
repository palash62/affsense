import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailListUpdateSchema } from "@/lib/validations";
import { deleteEmailList, updateEmailList } from "@/modules/email-marketing";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id } = await context.params;
      const body = await request.json();
      const parsed = emailListUpdateSchema.safeParse(body);
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
      if (parsed.data.name === undefined && parsed.data.campaignId === undefined) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Nothing to update",
              status: 422,
            },
          },
          { status: 422 },
        );
      }
      const data = await updateEmailList(session.user.id, id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id } = await context.params;
      const data = await deleteEmailList(session.user.id, id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
