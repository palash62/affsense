import { withAuth, ADMIN_PORTAL_ROLES } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { adminPublisherPostbackSchema } from "@/lib/validations";
import {
  assertPublisher,
  loadChannelPostbacks,
  parseJsonBody,
} from "@/lib/publisher-channel-postback-routes";
import { createPublisherPostback } from "@/services/publisher-postback.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(async () => {
    await assertPublisher(id);
    const [digitalProduct, cpa] = await Promise.all([
      loadChannelPostbacks(id, "DIGITAL_PRODUCT"),
      loadChannelPostbacks(id, "CPA"),
    ]);
    return Response.json({ data: { digitalProduct, cpa } });
  }, ADMIN_PORTAL_ROLES);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;

  return withAuth(async (session) => {
    const { channel, ...input } = await parseJsonBody(request, adminPublisherPostbackSchema);
    await assertPublisher(id);
    const data = await createPublisherPostback(id, channel, input);

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "admin.publisher_postback.created",
        entityType: "publisher_postback",
        entityId: data.id ?? id,
        metadata: { publisherId: id, channel, name: data.name, status: data.status, endpoint: data.endpoint },
      },
    });

    return Response.json({ data }, { status: 201 });
  }, ADMIN_PORTAL_ROLES);
}
