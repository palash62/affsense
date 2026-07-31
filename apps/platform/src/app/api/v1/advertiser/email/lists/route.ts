import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { emailListSchema } from "@/lib/validations";
import { createEmailList, listEmailLists } from "@/modules/email-marketing";

export async function GET() {
  return withAuth(async (session) => {
    const data = await listEmailLists(session.user.id);
    return Response.json({ data });
  }, ["ADVERTISER"]);
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = emailListSchema.safeParse(body);
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
      const data = await createEmailList(session.user.id, parsed.data);
      return Response.json({ data }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
