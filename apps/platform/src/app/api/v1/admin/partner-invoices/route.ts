import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  listPartnerInvoices,
  summarizePartnerInvoices,
} from "@/services/partner-invoice.service";

export async function GET() {
  return withAuth(async () => {
    try {
      const invoices = await listPartnerInvoices();
      return Response.json({ data: { invoices, summary: summarizePartnerInvoices(invoices) } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
