import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { generateAffiliateInvoices } from "@/services/affiliate-invoice.service";

export async function POST() {
  return withAuth(async (session) => {
    try {
      const data = await generateAffiliateInvoices(new Date(), session.user.id);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
