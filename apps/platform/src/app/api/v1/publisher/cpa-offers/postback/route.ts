import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { publisherPostbackSchema } from "@/lib/validations";
import {
  getPublisherPostback,
  listPublisherCpaPostbackDeliveries,
  upsertPublisherPostback,
} from "@/services/publisher-postback.service";

export async function GET() {
  return withAuth(async (session) => {
    try {
      const [data, deliveries] = await Promise.all([
        getPublisherPostback(session.user.id, "CPA"),
        listPublisherCpaPostbackDeliveries(session.user.id, 10),
      ]);
      return Response.json({ data: { ...data, deliveries } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}

export async function PATCH(request: Request) {
  return withAuth(async (session) => {
    try {
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
        channel: "CPA",
      });
      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["PUBLISHER"]);
}
