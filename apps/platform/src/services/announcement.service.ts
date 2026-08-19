import type {
  AnnouncementAudience,
  AnnouncementTone,
  PublisherAnnouncement,
  PublisherAnnouncementStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";

export type SerializedAnnouncement = {
  id: string;
  title: string;
  body: string;
  iconKey: string | null;
  audience: AnnouncementAudience;
  tone: AnnouncementTone;
  status: PublisherAnnouncementStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnnouncementInput = {
  title: string;
  body: string;
  iconKey?: string | null;
  audience: AnnouncementAudience;
  tone: AnnouncementTone;
  status?: PublisherAnnouncementStatus;
};

function serializeAnnouncement(row: PublisherAnnouncement): SerializedAnnouncement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    iconKey: row.iconKey,
    audience: row.audience,
    tone: row.tone,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function publishedAtForStatus(
  status: PublisherAnnouncementStatus,
  existing?: Date | null,
): Date | null {
  if (status === "PUBLISHED") {
    return existing ?? new Date();
  }
  return existing ?? null;
}

export async function listAnnouncementsForAdmin(): Promise<SerializedAnnouncement[]> {
  const rows = await prisma.publisherAnnouncement.findMany({
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map(serializeAnnouncement);
}

export async function listPublishedAnnouncements(
  audience: "ADVERTISER" | "PUBLISHER" | "ALL",
  take = 6,
): Promise<SerializedAnnouncement[]> {
  const rows = await prisma.publisherAnnouncement.findMany({
    where: {
      status: "PUBLISHED",
      ...(audience === "ALL"
        ? {}
        : {
            OR: [{ audience }, { audience: "BOTH" }],
          }),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map(serializeAnnouncement);
}

export async function createAnnouncement(input: AnnouncementInput): Promise<SerializedAnnouncement> {
  const status = input.status ?? "DRAFT";
  const row = await prisma.publisherAnnouncement.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      iconKey: input.iconKey?.trim() || null,
      audience: input.audience,
      tone: input.tone,
      status,
      publishedAt: publishedAtForStatus(status),
    },
  });
  return serializeAnnouncement(row);
}

export async function updateAnnouncement(
  id: string,
  input: Partial<AnnouncementInput>,
): Promise<SerializedAnnouncement> {
  const existing = await prisma.publisherAnnouncement.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Announcement");

  const status = input.status ?? existing.status;
  const row = await prisma.publisherAnnouncement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.body !== undefined ? { body: input.body.trim() } : {}),
      ...(input.iconKey !== undefined ? { iconKey: input.iconKey?.trim() || null } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      ...(input.tone !== undefined ? { tone: input.tone } : {}),
      ...(input.status !== undefined ? { status } : {}),
      publishedAt: publishedAtForStatus(status, existing.publishedAt),
    },
  });
  return serializeAnnouncement(row);
}

export async function deleteAnnouncement(id: string): Promise<{ id: string }> {
  const existing = await prisma.publisherAnnouncement.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Announcement");
  await prisma.publisherAnnouncement.delete({ where: { id } });
  return { id };
}
