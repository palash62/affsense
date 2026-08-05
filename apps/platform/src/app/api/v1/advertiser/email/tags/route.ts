import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailTagSchema } from "@/lib/validations";
import { createEmailTag, listEmailTags } from "@/modules/email-marketing";

export async function GET() {
  return withAuth(async (session) => {
    const data = await listEmailTags(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailTagSchema.safeParse(body);
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
      const data = await createEmailTag(session.user.id, {
        name: parsed.data.name,
        color: parsed.data.color,
      });
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
