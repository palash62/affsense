import { withAuth } from "@/lib/api-handler";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { errorResponse, Errors } from "@/lib/errors";
import { submitAdvertiserCpaInvoicePayment } from "@/services/advertiser-cpa-invoice.service";
import { z } from "zod";

const submitSchema = z.object({
  method: z.enum(["WISE", "BANK_TRANSFER", "STRIPE_CONNECT", "PAYPAL"]),
  reference: z.string().trim().min(1).max(200),
  note: z.string().trim().max(5000).optional().nullable(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      if (!canAdvertiserAccessCpaOffers(session.user.email)) {
        throw Errors.forbidden();
      }

      const { id } = await context.params;
      const body = await request.json().catch(() => null);
      const parsed = submitSchema.safeParse(body);
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

      const data = await submitAdvertiserCpaInvoicePayment(
        id,
        session.user.id,
        parsed.data,
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
