import type { ZodType } from "zod";
import { withAuth } from "@/lib/api-handler";
import { AppError, Errors } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { postbackTestFireSchema, publisherPostbackSchema } from "@/lib/validations";
import {
  createPublisherPostback,
  deletePublisherPostback,
  listPublisherCpaPostbackDeliveries,
  listPublisherDigitalProductPostbackDeliveries,
  listPublisherPostbacks,
  updatePublisherPostback,
} from "@/services/publisher-postback.service";
import { firePublisherPostbackTest } from "@/services/publisher-postback-dispatch";

export type MultiPostbackChannel = "DIGITAL_PRODUCT" | "CPA";

type ItemContext = { params: Promise<{ postbackId: string }> };

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload", 422);
  }
  return parsed.data;
}

/** Admin routes act on affiliates only. */
export async function assertPublisher(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (user?.role !== "PUBLISHER") throw Errors.notFound("Affiliate");
}

export async function loadChannelPostbacks(publisherId: string, channel: MultiPostbackChannel) {
  const [postbacks, deliveries] = await Promise.all([
    listPublisherPostbacks(publisherId, channel),
    channel === "CPA"
      ? listPublisherCpaPostbackDeliveries(publisherId, 10)
      : listPublisherDigitalProductPostbackDeliveries(publisherId, 10),
  ]);
  return { postbacks, deliveries };
}

/** GET (list + recent deliveries) and POST (create) for the signed-in affiliate. */
export function publisherChannelPostbackCollection(channel: MultiPostbackChannel) {
  return {
    GET: () =>
      withAuth(async (session) => {
        const data = await loadChannelPostbacks(session.user.id, channel);
        return Response.json({ data });
      }, ["PUBLISHER"]),
    POST: (request: Request) =>
      withAuth(async (session) => {
        const input = await parseJsonBody(request, publisherPostbackSchema);
        const data = await createPublisherPostback(session.user.id, channel, input);
        return Response.json({ data }, { status: 201 });
      }, ["PUBLISHER"]),
  };
}

/** PATCH and DELETE for one of the signed-in affiliate's postbacks. */
export function publisherChannelPostbackItem(channel: MultiPostbackChannel) {
  return {
    PATCH: async (request: Request, { params }: ItemContext) => {
      const { postbackId } = await params;
      return withAuth(async (session) => {
        const input = await parseJsonBody(request, publisherPostbackSchema);
        const data = await updatePublisherPostback(session.user.id, postbackId, input, channel);
        return Response.json({ data });
      }, ["PUBLISHER"]);
    },
    DELETE: async (_request: Request, { params }: ItemContext) => {
      const { postbackId } = await params;
      return withAuth(async (session) => {
        const data = await deletePublisherPostback(session.user.id, postbackId, channel);
        return Response.json({ data });
      }, ["PUBLISHER"]);
    },
  };
}

export function publisherChannelPostbackTestFire(channel: MultiPostbackChannel) {
  return (request: Request) =>
    withAuth(async (session) => {
      const input = await parseJsonBody(request, postbackTestFireSchema);
      const data = await firePublisherPostbackTest({
        publisherId: session.user.id,
        postbackId: input.postbackId || undefined,
        endpoint: input.endpoint,
        channel,
      });
      return Response.json({ data });
    }, ["PUBLISHER"]);
}
