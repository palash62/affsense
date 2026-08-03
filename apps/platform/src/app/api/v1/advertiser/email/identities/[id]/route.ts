import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { deleteSendingIdentity } from "@/modules/email-marketing";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id } = await context.params;
      const data = await deleteSendingIdentity(session.user.id, id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
