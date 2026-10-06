import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { publisherPostbackSchema } from "@/lib/validations";
import { assertPublisher, parseJsonBody } from "@/lib/publisher-channel-postback-routes";
import {
  deletePublisherPostback,
  updatePublisherPostback,
} from "@/services/publisher-postback.service";

type RouteContext = { params: Promise<{ id: string; postbackId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id, postbackId } = await params;

  return withAuth(async (session) => {
    const input = await parseJsonBody(request, publisherPostbackSchema);
    await assertPublisher(id);
    const data = await updatePublisherPostback(id, postbackId, input);

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "admin.publisher_postback.updated",
        entityType: "publisher_postback",
        entityId: postbackId,
        metadata: {
          publisherId: id,
          channel: data.channel,
          name: data.name,
          status: data.status,
          endpoint: data.endpoint,
        },
      },
    });

    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id, postbackId } = await params;

  return withAuth(async (session) => {
    await assertPublisher(id);
    const data = await deletePublisherPostback(id, postbackId);

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "admin.publisher_postback.deleted",
        entityType: "publisher_postback",
        entityId: postbackId,
        metadata: { publisherId: id, channel: data.channel, name: data.name, endpoint: data.endpoint },
      },
    });

    return Response.json({ data });
  }, ADMIN_PORTAL_ROLES);
}
