import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { normalizeYouTubeUrl } from "@/lib/youtube";
import { isRichHtml, richTextToPlain } from "@/lib/rich-text";
import { sanitizeHtml } from "@/modules/page-builder/lib/sanitize";

export type SerializedTutorial = {
  id: string;
  title: string;
  /** Sanitized HTML from the rich editor, or plain text for older tutorials. */
  description: string;
  descriptionText: string;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

function serializeTutorial(row: {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SerializedTutorial {
  const description = cleanDescription(row.description);
  return {
    id: row.id,
    title: row.title,
    description,
    descriptionText: richTextToPlain(description),
    youtubeUrl: row.youtubeUrl,
    thumbnailUrl: row.thumbnailUrl,
    sortOrder: row.sortOrder,
    isPublished: row.isPublished,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function cleanDescription(value: string): string {
  const trimmed = value.trim();
  return isRichHtml(trimmed) ? sanitizeHtml(trimmed) : trimmed;
}

function resolveThumbnailUrl(thumbnailUrl: string | null | undefined): string | null {
  const trimmed = thumbnailUrl?.trim() ?? "";
  if (!trimmed) return null;
  if (!trimmed.startsWith("/uploads/builder/")) {
    throw Errors.validation("Thumbnail must be uploaded from the admin panel.");
  }
  return trimmed;
}

function resolveYouTubeUrl(youtubeUrl: string | null | undefined): string | null {
  const trimmed = youtubeUrl?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = normalizeYouTubeUrl(trimmed);
  if (!normalized) {
    throw Errors.validation("Enter a valid YouTube video URL.");
  }
  return normalized;
}

export async function listTutorialsForAdmin(): Promise<SerializedTutorial[]> {
  const rows = await prisma.tutorial.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeTutorial);
}

export async function listPublishedTutorials(): Promise<SerializedTutorial[]> {
  const rows = await prisma.tutorial.findMany({
    where: { isPublished: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeTutorial);
}

export async function getTutorialById(id: string): Promise<SerializedTutorial> {
  const row = await prisma.tutorial.findUnique({ where: { id } });
  if (!row) throw Errors.notFound("Tutorial");
  return serializeTutorial(row);
}

export async function createTutorial(input: {
  title: string;
  description: string;
  youtubeUrl?: string | null;
  thumbnailUrl?: string | null;
  sortOrder?: number;
  isPublished?: boolean;
}): Promise<SerializedTutorial> {
  const row = await prisma.tutorial.create({
    data: {
      title: input.title.trim(),
      description: cleanDescription(input.description),
      youtubeUrl: resolveYouTubeUrl(input.youtubeUrl),
      thumbnailUrl: resolveThumbnailUrl(input.thumbnailUrl),
      sortOrder: input.sortOrder ?? 0,
      isPublished: input.isPublished ?? true,
    },
  });
  return serializeTutorial(row);
}

export async function updateTutorial(
  id: string,
  input: {
    title?: string;
    description?: string;
    youtubeUrl?: string | null;
    thumbnailUrl?: string | null;
    sortOrder?: number;
    isPublished?: boolean;
  },
): Promise<SerializedTutorial> {
  await getTutorialById(id);

  const data: {
    title?: string;
    description?: string;
    youtubeUrl?: string | null;
    thumbnailUrl?: string | null;
    sortOrder?: number;
    isPublished?: boolean;
  } = {};

  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = cleanDescription(input.description);
  if (input.youtubeUrl !== undefined) data.youtubeUrl = resolveYouTubeUrl(input.youtubeUrl);
  if (input.thumbnailUrl !== undefined) data.thumbnailUrl = resolveThumbnailUrl(input.thumbnailUrl);
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.isPublished !== undefined) data.isPublished = input.isPublished;

  const row = await prisma.tutorial.update({ where: { id }, data });
  return serializeTutorial(row);
}

export async function deleteTutorial(id: string): Promise<{ id: string }> {
  await getTutorialById(id);
  await prisma.tutorial.delete({ where: { id } });
  return { id };
}
