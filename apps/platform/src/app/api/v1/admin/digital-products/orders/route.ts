import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { z } from "zod";
import { listDigitalProductOrders } from "@/services/digital-product.service";

const adminDigitalProductOrdersQuerySchema = z.object({
  publisherId: z.string().trim().optional(),
  subId: z.string().trim().optional(),
  eventType: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  return withAuth(async () => {
    try {
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const parsed = adminDigitalProductOrdersQuerySchema.safeParse({
        publisherId: searchParams.get("publisherId") ?? undefined,
        subId: searchParams.get("subId") ?? undefined,
        eventType: searchParams.get("eventType") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined,
        page,
        limit,
      });

      if (!parsed.success) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: parsed.error.issues[0]?.message ?? "Invalid query",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const from = parsed.data.from ? new Date(parsed.data.from) : undefined;
      const to = parsed.data.to
        ? new Date(
            parsed.data.to.includes("T")
              ? parsed.data.to
              : `${parsed.data.to}T23:59:59`,
          )
        : undefined;

      const data = await listDigitalProductOrders({
        publisherId: parsed.data.publisherId,
        subId: parsed.data.subId,
        eventType: parsed.data.eventType,
        from: from && !Number.isNaN(from.getTime()) ? from : undefined,
        to: to && !Number.isNaN(to.getTime()) ? to : undefined,
        page: parsed.data.page,
        limit: parsed.data.limit ?? 15,
      });

      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
