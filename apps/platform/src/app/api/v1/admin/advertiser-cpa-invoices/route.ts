import { withAuth, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  cancelAdvertiserCpaInvoice,
  generateAdvertiserCpaInvoices,
  listAdvertiserCpaInvoicesForAdmin,
  payAdvertiserCpaInvoice,
} from "@/services/advertiser-cpa-invoice.service";
import { z } from "zod";

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const status = searchParams.get("status") ?? undefined;
      const advertiserId = searchParams.get("advertiserId") ?? undefined;
      const data = await listAdvertiserCpaInvoicesForAdmin({
        page,
        limit,
        status: status as "UNPAID" | "PAID" | "CANCELLED" | "ALL" | undefined,
        advertiserId,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}

const generateSchema = z.object({
  timezone: z.string().trim().optional(),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = generateSchema.safeParse(body);
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
      const data = await generateAdvertiserCpaInvoices(
        new Date(),
        parsed.data.timezone ?? "UTC",
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}

const paySchema = z.object({
  invoiceId: z.string().trim().min(1),
  method: z.enum(["WISE", "BANK_TRANSFER", "STRIPE_CONNECT", "PAYPAL"]),
  reference: z.string().trim().max(200).optional().nullable(),
  note: z.string().trim().max(5000).optional().nullable(),
  action: z.enum(["pay", "cancel"]).default("pay"),
  cancelReason: z.string().trim().max(5000).optional().nullable(),
});

export async function PATCH(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => null);
      const parsed = paySchema.safeParse(body);
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

      if (parsed.data.action === "cancel") {
        const data = await cancelAdvertiserCpaInvoice(
          parsed.data.invoiceId,
          parsed.data.cancelReason,
        );
        return Response.json({ data });
      }

      const data = await payAdvertiserCpaInvoice(parsed.data.invoiceId, {
        method: parsed.data.method,
        reference: parsed.data.reference,
        note: parsed.data.note,
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}
