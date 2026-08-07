import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailBroadcastPreviewSchema } from "@/lib/validations";
import { previewBroadcastAudience } from "@/modules/email-marketing";

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailBroadcastPreviewSchema.safeParse(body);
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
      const data = await previewBroadcastAudience(session.user.id, parsed.data);
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
