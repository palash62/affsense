import { z } from "zod";
import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, Errors } from "@/lib/errors";
import { rejectDigitalProductConversion } from "@/services/digital-product-reject.service";

const rejectSchema = z.object({
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(async (session) => {
    try {
      if (session.impersonatorId) return errorResponse(Errors.forbidden());

      const { id } = await params;
      const parsed = rejectSchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        throw Errors.validation(parsed.error.issues[0]?.message ?? "Invalid reason", "reason");
      }

      const data = await rejectDigitalProductConversion(id, session.user.id, parsed.data.reason);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
