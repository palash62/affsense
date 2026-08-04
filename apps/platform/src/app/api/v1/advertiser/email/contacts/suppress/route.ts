import { withAuth } from "@/lib/api-handler";
import { errorResponse, AppError } from "@/lib/errors";
import { suppressContactByEmail } from "@/modules/email-marketing";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const json = await request.json();
      const parsed = bodySchema.safeParse(json);
      if (!parsed.success) {
        throw new AppError("VALIDATION_ERROR", "A valid email is required", 422);
      }
      const contact = await suppressContactByEmail(session.user.id, parsed.data.email);
      if (!contact) {
        throw new AppError(
          "NOT_FOUND",
          "No subscriber found with that email. Only existing contacts can be suppressed.",
          404,
        );
      }
      return Response.json({ data: contact });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
