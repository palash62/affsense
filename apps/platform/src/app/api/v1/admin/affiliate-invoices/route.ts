import type { AffiliateInvoiceStatus } from "@prisma/client";
import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { listAffiliateInvoicesForAdmin } from "@/services/affiliate-invoice.service";

const STATUSES = new Set(["UNPAID", "PAID", "CANCELLED", "OVERDUE"]);

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const data = await listAffiliateInvoicesForAdmin({
        status:
          status && STATUSES.has(status)
            ? (status as AffiliateInvoiceStatus | "OVERDUE")
            : undefined,
        publisherId: searchParams.get("publisherId") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        page: Number(searchParams.get("page")) || 1,
        limit: Number(searchParams.get("limit")) || 20,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
