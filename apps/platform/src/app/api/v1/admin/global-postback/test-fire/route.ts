import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse, AppError } from "@/lib/errors";
import { fireGlobalPostbackTest } from "@/services/cpa-global-postback-test.service";
import { z } from "zod";

const schema = z.object({
  clickId: z.string().trim().min(1, "clickId is required"),
  payout: z.string().trim().optional(),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        throw new AppError(
          "VALIDATION_ERROR",
          parsed.error.issues[0]?.message ?? "Invalid payload",
          422,
        );
      }

      const data = await fireGlobalPostbackTest(parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
