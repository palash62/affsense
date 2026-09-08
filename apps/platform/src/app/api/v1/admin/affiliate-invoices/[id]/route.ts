import type { PayoutMethod } from "@prisma/client";
import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import {
  cancelAffiliateInvoice,
  payAffiliateInvoice,
} from "@/services/affiliate-invoice.service";

const PAYOUT_METHODS = new Set<PayoutMethod>([
  "WISE",
  "BANK_TRANSFER",
  "STRIPE_CONNECT",
  "PAYPAL",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      if (session.impersonatorId) return errorResponse(Errors.forbidden());

      const { id } = await params;
      const body = await request.json();
      const action = typeof body.action === "string" ? body.action : "";

      if (action === "pay") {
        const method = body.method as PayoutMethod;
        if (!PAYOUT_METHODS.has(method)) {
          throw Errors.validation("A valid payment method is required", "method");
        }
        const data = await payAffiliateInvoice(
          id,
          {
            method,
            reference: typeof body.reference === "string" ? body.reference : undefined,
            note: typeof body.note === "string" ? body.note : undefined,
          },
          session.user.id,
        );
        return Response.json({ data });
      }

      if (action === "cancel") {
        const data = await cancelAffiliateInvoice(
          id,
          typeof body.reason === "string" ? body.reason : "",
          session.user.id,
        );
        return Response.json({ data });
      }

      throw Errors.validation("Unknown action. Use 'pay' or 'cancel'.", "action");
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
