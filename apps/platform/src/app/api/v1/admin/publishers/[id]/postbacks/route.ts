import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { Errors, errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { adminPublisherPostbackSchema } from "@/lib/validations";
import {
  getPublisherPostback,
  listPublisherCpaPostbackDeliveries,
  listPublisherDigitalProductPostbackDeliveries,
  upsertPublisherPostback,
} from "@/services/publisher-postback.service";

type RouteContext = { params: Promise<{ id: string }> };

async function assertPublisher(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (user?.role !== "PUBLISHER") throw Errors.notFound("Affiliate");
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(async () => {
    try {
      await assertPublisher(id);
      const [digitalProduct, digitalProductDeliveries, cpa, cpaDeliveries] = await Promise.all([
        getPublisherPostback(id, "DIGITAL_PRODUCT"),
        listPublisherDigitalProductPostbackDeliveries(id, 10),
        getPublisherPostback(id, "CPA"),
        listPublisherCpaPostbackDeliveries(id, 10),
      ]);
      return Response.json({
        data: {
          digitalProduct: { ...digitalProduct, deliveries: digitalProductDeliveries },
          cpa: { ...cpa, deliveries: cpaDeliveries },
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(async (session) => {
    try {
      const body = await request.json();
      const parsed = adminPublisherPostbackSchema.safeParse(body);
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

      await assertPublisher(id);
      const { channel, status, endpoint } = parsed.data;
      const data = await upsertPublisherPostback(id, { channel, status, endpoint });

      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "admin.publisher_postback.updated",
          entityType: "publisher_postback",
          entityId: data.id ?? id,
          metadata: { publisherId: id, channel, status, endpoint: data.endpoint },
        },
      });

      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ADMIN_PORTAL_ROLES);
}
