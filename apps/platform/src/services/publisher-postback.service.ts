import type { CpaPostbackDeliveryStatus, GlobalPostbackStatus } from "@prisma/client";
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export type SerializedPublisherPostback = {
  id: string | null;
  type: "S2S";
  status: GlobalPostbackStatus;
  endpoint: string;
  updatedAt: string | null;
};

const DEFAULT: SerializedPublisherPostback = {
  id: null,
  type: "S2S",
  status: "INACTIVE",
  endpoint: "",
  updatedAt: null,
};

function serialize(
  row: {
    id: string;
    status: GlobalPostbackStatus;
    endpoint: string;
    updatedAt: Date;
  } | null,
): SerializedPublisherPostback {
  if (!row) return { ...DEFAULT };
  return {
    id: row.id,
    type: "S2S",
    status: row.status,
    endpoint: row.endpoint,
    updatedAt: row.updatedAt.toISOString(),
  };
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

export async function getPublisherPostback(
  publisherId: string,
): Promise<SerializedPublisherPostback> {
  const row = await prisma.publisherPostback.findUnique({
    where: { publisherId },
  });
  return serialize(row);
}

export async function upsertPublisherPostback(
  publisherId: string,
  input: {
    status: GlobalPostbackStatus;
    endpoint: string;
  },
): Promise<SerializedPublisherPostback> {
  const status = input.status;
  const endpoint = input.endpoint.trim();

  if (status === "ACTIVE" && !endpoint) {
    throw Errors.validation("Endpoint is required when status is Active.");
  }

  if (endpoint) {
    assertHttpTemplateUrl(endpoint);
  }

  const row = await prisma.publisherPostback.upsert({
    where: { publisherId },
    create: {
      publisherId,
      type: "S2S",
      status,
      endpoint,
    },
    update: {
      type: "S2S",
      status,
      endpoint,
    },
  });

  return serialize(row);
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
