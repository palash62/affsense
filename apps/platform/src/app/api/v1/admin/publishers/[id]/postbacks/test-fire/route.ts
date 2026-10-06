import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { Errors, errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { adminPostbackTestFireSchema } from "@/lib/validations";
import { firePublisherPostbackTest } from "@/services/publisher-postback-dispatch";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withAuth(async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = adminPostbackTestFireSchema.safeParse(body);
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

      const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (user?.role !== "PUBLISHER") throw Errors.notFound("Affiliate");

      const result = await firePublisherPostbackTest({
        publisherId: id,
        postbackId: parsed.data.postbackId || undefined,
        endpoint: parsed.data.endpoint,
        channel: parsed.data.channel,
      });
      return Response.json({ data: result });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
