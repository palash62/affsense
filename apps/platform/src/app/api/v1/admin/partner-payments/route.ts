import { endOfDay, endOfMonth, parseISO, startOfMonth } from "date-fns";
import { withAuth } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import {
  adminPartnerPaymentCreateSchema,
  adminPartnerPaymentListQuerySchema,
} from "@/lib/validations";
import {
  createPartnerPayment,
  getPartnerSettlementByMonth,
  listPartnerPayments,
  parsePaidAtInput,
} from "@/services/partner-payment.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const url = new URL(request.url);
      const parsed = adminPartnerPaymentListQuerySchema.safeParse({
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return errorResponse(
          Errors.validation(issue?.message ?? "Invalid query", issue?.path?.[0]?.toString()),
        );
      }

      const fromMonth = parsed.data.from;
      const toMonth = parsed.data.to;

      if (fromMonth && toMonth) {
        const from = startOfMonth(parseISO(`${fromMonth}-01`));
        const to = endOfDay(endOfMonth(parseISO(`${toMonth}-01`)));
        const settlement = await getPartnerSettlementByMonth(from, to);
        return Response.json({ data: settlement });
      }

      const payments = await listPartnerPayments({ fromMonth, toMonth });
      return Response.json({ data: { payments } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    if (session.impersonatorId) {
      return errorResponse(Errors.forbidden());
    }

    try {
      const body = await request.json();
      const parsed = adminPartnerPaymentCreateSchema.safeParse({
        ...body,
        amount: typeof body?.amount === "string" ? Number(body.amount) : body?.amount,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return errorResponse(
          Errors.validation(issue?.message ?? "Invalid body", issue?.path?.[0]?.toString()),
        );
      }

      const payment = await createPartnerPayment({
        periodMonth: parsed.data.periodMonth,
        amount: parsed.data.amount,
        paidAt: parsePaidAtInput(parsed.data.paidAt),
        method: parsed.data.method,
        note: parsed.data.note,
        adminId: session.user.id,
      });

      return Response.json({ data: payment }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}
