import type {
  CpaPostbackDeliveryStatus,
  GlobalPostbackStatus,
  PublisherPostbackChannel,
} from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export type SerializedPublisherPostback = {
  id: string | null;
  channel: PublisherPostbackChannel;
  name: string | null;
  type: "S2S";
  status: GlobalPostbackStatus;
  endpoint: string;
  updatedAt: string | null;
};

type PostbackRow = {
  id: string;
  channel: PublisherPostbackChannel;
  name: string | null;
  status: GlobalPostbackStatus;
  endpoint: string;
  updatedAt: Date;
};

function defaultSerialized(channel: PublisherPostbackChannel): SerializedPublisherPostback {
  return {
    id: null,
    channel,
    name: null,
    type: "S2S",
    status: "INACTIVE",
    endpoint: "",
    updatedAt: null,
  };
}

function serializeRow(row: PostbackRow): SerializedPublisherPostback {
  return {
    id: row.id,
    channel: row.channel,
    name: row.name,
    type: "S2S",
    status: row.status,
    endpoint: row.endpoint,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serialize(
  channel: PublisherPostbackChannel,
  row: PostbackRow | null,
): SerializedPublisherPostback {
  return row ? serializeRow(row) : defaultSerialized(channel);
}

export function assertHttpTemplateUrl(endpoint: string) {
  const withoutMacros = endpoint.replace(/\{[a-z0-9_]+\}/gi, "placeholder");
  let parsed: URL;
  try {
    parsed = new URL(withoutMacros);
  } catch {
    throw Errors.validation("Enter a valid http(s) postback URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw Errors.validation("Postback URL must start with http:// or https://");
  }
}

function normalizePostbackInput(input: {
  status: GlobalPostbackStatus;
  endpoint: string;
  name?: string | null;
}) {
  const endpoint = input.endpoint.trim();
  if (input.status === "ACTIVE" && !endpoint) {
    throw Errors.validation("Endpoint is required when status is Active.");
  }
  if (endpoint) assertHttpTemplateUrl(endpoint);
  const name = input.name?.trim().slice(0, 100) || null;
  return { status: input.status, endpoint, name };
}

/** CPL keeps a single postback per publisher; the oldest row wins. */
export async function getPublisherPostback(
  publisherId: string,
  channel: PublisherPostbackChannel = "CPL",
): Promise<SerializedPublisherPostback> {
  const row = await prisma.publisherPostback.findFirst({
    where: { publisherId, channel },
    orderBy: { createdAt: "asc" },
  });
  return serialize(channel, row);
}

export async function upsertPublisherPostback(
  publisherId: string,
  input: {
    status: GlobalPostbackStatus;
    endpoint: string;
    channel?: PublisherPostbackChannel;
  },
): Promise<SerializedPublisherPostback> {
  const channel = input.channel ?? "CPL";
  const { status, endpoint } = normalizePostbackInput(input);

  const existing = await prisma.publisherPostback.findFirst({
    where: { publisherId, channel },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const row = existing
    ? await prisma.publisherPostback.update({
        where: { id: existing.id },
        data: { type: "S2S", status, endpoint },
      })
    : await prisma.publisherPostback.create({
        data: { publisherId, channel, type: "S2S", status, endpoint },
      });

  return serialize(channel, row);
}

export async function listPublisherPostbacks(
  publisherId: string,
  channel: PublisherPostbackChannel,
): Promise<SerializedPublisherPostback[]> {
  const rows = await prisma.publisherPostback.findMany({
    where: { publisherId, channel },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(serializeRow);
}

export async function createPublisherPostback(
  publisherId: string,
  channel: PublisherPostbackChannel,
  input: { name?: string | null; status: GlobalPostbackStatus; endpoint: string },
): Promise<SerializedPublisherPostback> {
  const data = normalizePostbackInput(input);
  const row = await prisma.publisherPostback.create({
    data: { publisherId, channel, type: "S2S", ...data },
  });
  return serializeRow(row);
}

async function findOwnedPostback(
  publisherId: string,
  postbackId: string,
  channel?: PublisherPostbackChannel,
) {
  const row = await prisma.publisherPostback.findFirst({
    where: { id: postbackId, publisherId, ...(channel ? { channel } : {}) },
  });
  if (!row) throw Errors.notFound("Postback");
  return row;
}

export async function updatePublisherPostback(
  publisherId: string,
  postbackId: string,
  input: { name?: string | null; status: GlobalPostbackStatus; endpoint: string },
  channel?: PublisherPostbackChannel,
): Promise<SerializedPublisherPostback> {
  const existing = await findOwnedPostback(publisherId, postbackId, channel);
  const data = normalizePostbackInput({
    ...input,
    name: input.name === undefined ? existing.name : input.name,
  });
  const row = await prisma.publisherPostback.update({
    where: { id: existing.id },
    data: { type: "S2S", ...data },
  });
  return serializeRow(row);
}

export async function deletePublisherPostback(
  publisherId: string,
  postbackId: string,
  channel?: PublisherPostbackChannel,
): Promise<SerializedPublisherPostback> {
  const existing = await findOwnedPostback(publisherId, postbackId, channel);
  await prisma.publisherPostback.delete({ where: { id: existing.id } });
  return serializeRow(existing);
}

export type PublisherPostbackDeliveryRow = {
  id: string;
  leadId: string | null;
  url: string;
  event: "PAID" | "TEST";
  status: CpaPostbackDeliveryStatus;
  httpStatus: number | null;
  error: string | null;
  payout: number | null;
  attempts: number;
  createdAt: Date;
};

export async function listPublisherPostbackDeliveries(filters: {
  publisherId: string;
  status?: CpaPostbackDeliveryStatus | "all";
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
  const skip = (page - 1) * limit;

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (filters.dateFrom) createdAt.gte = startOfDay(filters.dateFrom);
  if (filters.dateTo) createdAt.lte = endOfDay(filters.dateTo);

  const search = filters.search?.trim();
  const status =
    filters.status && filters.status !== "all" ? filters.status : undefined;

  const where = {
    publisherId: filters.publisherId,
    ...(status ? { status } : {}),
    ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    ...(search
      ? {
          OR: [
            { leadId: { contains: search } },
            { url: { contains: search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.publisherPostbackDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        leadId: true,
        url: true,
        event: true,
        status: true,
        httpStatus: true,
        error: true,
        payout: true,
        attempts: true,
        createdAt: true,
      },
    }),
    prisma.publisherPostbackDelivery.count({ where }),
  ]);

  const data: PublisherPostbackDeliveryRow[] = rows.map((row) => ({
    id: row.id,
    leadId: row.leadId,
    url: row.url,
    event: row.event,
    status: row.status,
    httpStatus: row.httpStatus,
    error: row.error,
    payout: row.payout != null ? Number(row.payout) : null,
    attempts: row.attempts,
    createdAt: row.createdAt,
  }));

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export type ChannelPostbackDeliveryRow = {
  id: string;
  refId: string;
  postbackId: string | null;
  /** Postback name, or its URL when unnamed; null once the postback is deleted. */
  postbackLabel: string | null;
  url: string;
  status: CpaPostbackDeliveryStatus;
  httpStatus: number | null;
  error: string | null;
  payout: number | null;
  createdAt: string;
};

async function loadPostbackLabels(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const rows = await prisma.publisherPostback.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, endpoint: true },
  });
  return new Map(rows.map((row) => [row.id, row.name?.trim() || row.endpoint]));
}

export async function listPublisherCpaPostbackDeliveries(
  publisherId: string,
  limit = 10,
): Promise<ChannelPostbackDeliveryRow[]> {
  const rows = await prisma.cpaPostbackDelivery.findMany({
    where: {
      target: "PUBLISHER",
      conversion: {
        clickRecord: { publisherId },
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
    select: {
      id: true,
      conversionId: true,
      postbackId: true,
      url: true,
      status: true,
      httpStatus: true,
      error: true,
      createdAt: true,
      conversion: { select: { payout: true } },
    },
  });

  const labels = await loadPostbackLabels(rows.map((row) => row.postbackId));
  return rows.map((row) => ({
    id: row.id,
    refId: row.conversionId,
    postbackId: row.postbackId || null,
    postbackLabel: labels.get(row.postbackId) ?? null,
    url: row.url,
    status: row.status,
    httpStatus: row.httpStatus,
    error: row.error,
    payout: row.conversion.payout != null ? Number(row.conversion.payout) : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPublisherDigitalProductPostbackDeliveries(
  publisherId: string,
  limit = 10,
): Promise<ChannelPostbackDeliveryRow[]> {
  const rows = await prisma.digitalProductPostbackDelivery.findMany({
    where: { publisherId },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
    select: {
      id: true,
      webhookEventId: true,
      postbackId: true,
      url: true,
      status: true,
      httpStatus: true,
      error: true,
      payout: true,
      createdAt: true,
    },
  });

  const labels = await loadPostbackLabels(rows.map((row) => row.postbackId));
  return rows.map((row) => ({
    id: row.id,
    refId: row.webhookEventId,
    postbackId: row.postbackId === "legacy" ? null : row.postbackId,
    postbackLabel: labels.get(row.postbackId) ?? null,
    url: row.url,
    status: row.status,
    httpStatus: row.httpStatus,
    error: row.error,
    payout: row.payout != null ? Number(row.payout) : null,
    createdAt: row.createdAt.toISOString(),
  }));
}
