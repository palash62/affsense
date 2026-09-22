import { withAuth, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  approveAdvertiserCpaInvoicePayment,
  cancelAdvertiserCpaInvoice,
  generateAdvertiserCpaInvoices,
  listAdvertiserCpaInvoicesForAdmin,
  rejectAdvertiserCpaInvoicePayment,
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
        status: status as
          | "UNPAID"
          | "PENDING_APPROVAL"
          | "PAID"
          | "CANCELLED"
          | "ALL"
          | undefined,
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

const patchSchema = z.object({
  invoiceId: z.string().trim().min(1),
  action: z.enum(["approve", "reject", "cancel"]),
  note: z.string().trim().max(5000).optional().nullable(),
  cancelReason: z.string().trim().max(5000).optional().nullable(),
});

export async function PATCH(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => null);
      const parsed = patchSchema.safeParse(body);
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

      if (parsed.data.action === "reject") {
        const data = await rejectAdvertiserCpaInvoicePayment(
          parsed.data.invoiceId,
          parsed.data.note,
        );
        return Response.json({ data });
      }

      const data = await approveAdvertiserCpaInvoicePayment(
        parsed.data.invoiceId,
        parsed.data.note,
      );
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADMIN"]);
}
