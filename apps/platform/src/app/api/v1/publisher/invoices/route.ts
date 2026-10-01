import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { requestAffiliateInvoice } from "@/services/affiliate-invoice.service";

export async function POST() {
  return withAuth(async (session) => {
    try {
      const data = await requestAffiliateInvoice(session.user.id);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
