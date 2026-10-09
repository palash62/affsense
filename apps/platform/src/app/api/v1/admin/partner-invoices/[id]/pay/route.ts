import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import { adminPartnerInvoicePaySchema } from "@/lib/validations";
import { markPartnerInvoicePaid, parsePaidAtInput } from "@/services/partner-invoice.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    if (session.impersonatorId) return errorResponse(Errors.forbidden());

    try {
      const { id } = await params;
      const body = await request.json().catch(() => null);
      const parsed = adminPartnerInvoicePaySchema.safeParse(body ?? {});
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return errorResponse(
          Errors.validation(issue?.message ?? "Invalid body", issue?.path?.[0]?.toString()),
        );
      }

      const invoice = await markPartnerInvoicePaid(
        id,
        {
          paidAt: parsePaidAtInput(parsed.data.paidAt),
          method: parsed.data.method,
          reference: parsed.data.reference,
          note: parsed.data.note,
        },
        session.user.id,
      );
      return Response.json({ data: invoice });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
