import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  attachTagToContact,
  detachTagFromContact,
} from "@/modules/email-marketing";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id, contactId } = await context.params;
      const data = await attachTagToContact(session.user.id, id, contactId);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; contactId: string }> },
) {
  return withAuth(async (session) => {
    try {
      const { id, contactId } = await context.params;
      const data = await detachTagFromContact(session.user.id, id, contactId);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
