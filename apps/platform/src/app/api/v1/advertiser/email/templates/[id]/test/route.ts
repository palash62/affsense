import { withAuth } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import { sendTestEmail } from "@/modules/email-marketing";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const to = typeof body.to === "string" ? body.to : session.user.email;
      const fromEmail =
        typeof body.fromEmail === "string" && body.fromEmail.trim()
          ? body.fromEmail.trim()
          : null;
      const fromName =
        typeof body.fromName === "string" && body.fromName.trim()
          ? body.fromName.trim()
          : null;
      const result = await sendTestEmail(session.user.id, id, to, {
        fromEmail,
        fromName,
      });
      if (!result.ok) {
        return Response.json(
          { error: { code: "SEND_FAILED", message: result.error, status: 502 } },
          { status: 502 },
        );
      }
      return Response.json({ data: { messageId: result.messageId } });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
