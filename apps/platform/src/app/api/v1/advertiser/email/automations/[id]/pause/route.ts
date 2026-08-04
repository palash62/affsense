import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { pauseAutomation } from "@/modules/email-marketing";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const data = await pauseAutomation(session.user.id, id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
