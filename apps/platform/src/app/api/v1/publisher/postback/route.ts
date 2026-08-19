import { withAuth } from "@/lib/api-handler";
import { publisherPostbackSchema } from "@/lib/validations";
import {
  getPublisherPostback,
  upsertPublisherPostback,
} from "@/services/publisher-postback.service";

export async function GET() {
  return withAuth(async (session) => {
    const data = await getPublisherPostback(session.user.id);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json();
    const parsed = publisherPostbackSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message ?? "Invalid payload",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    const data = await upsertPublisherPostback(session.user.id, {
      status: parsed.data.status,
      endpoint: parsed.data.endpoint,
    });
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
