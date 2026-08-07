import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailBroadcastSchema } from "@/lib/validations";
import { createBroadcast, listBroadcasts } from "@/modules/email-marketing";

export async function GET() {
  return withAuth(async (session) => {
    const data = await listBroadcasts(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailBroadcastSchema.safeParse(body);
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
      const data = await createBroadcast(session.user.id, parsed.data);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
