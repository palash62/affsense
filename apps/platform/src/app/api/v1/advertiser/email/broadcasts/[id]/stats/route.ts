import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { getBroadcastStats } from "@/modules/email-marketing";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const data = await getBroadcastStats(session.user.id, id);
      if (!data) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "Broadcast not found", status: 404 } },
          { status: 404 },
        );
      }
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
