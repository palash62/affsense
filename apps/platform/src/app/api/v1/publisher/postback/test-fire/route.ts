import { withAuth } from "@/lib/api-handler";
import { AppError } from "@/lib/errors";
import { firePublisherPostbackTest } from "@/services/publisher-postback-dispatch";
import { z } from "zod";

const schema = z.object({
  endpoint: z.string().trim().max(20_000).optional(),
});

export async function POST(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid payload",
        422,
      );
    }

    const data = await firePublisherPostbackTest({
      publisherId: session.user.id,
      endpoint: parsed.data.endpoint,
    });
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
