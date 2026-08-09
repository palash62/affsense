import { withAuth, parsePagination, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { testSmtpConnection } from "@/services/email.service";
import { z } from "zod";

const testSchema = z.object({
  testTo: z.string().email().optional(),
});

export async function POST(request: Request) {
  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = testSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: { code: "VALIDATION_ERROR", message: "Invalid email address", status: 422 } },
          { status: 422 },
        );
      }

      const result = await testSmtpConnection(parsed.data.testTo);
      return Response.json(result, { status: result.ok ? 200 : 422 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
