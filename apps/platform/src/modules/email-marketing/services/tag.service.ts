import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export type EmailTagRow = {
  id: string;
  name: string;
  color: string | null;
  contactCount: number;
  createdAt: Date;
};

function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function assertTagOwned(advertiserId: string, id: string) {
  const tag = await prisma.emailTag.findFirst({
    where: { id, advertiserId },
  });
  if (!tag) throw new AppError("NOT_FOUND", "Tag not found", 404);
  return tag;
}

async function assertContactOwned(advertiserId: string, contactId: string) {
  const contact = await prisma.emailContact.findFirst({
    where: { id: contactId, advertiserId },
    select: { id: true },
  });
  if (!contact) throw new AppError("NOT_FOUND", "Contact not found", 404);
  return contact;
}

export async function listEmailTags(advertiserId: string): Promise<EmailTagRow[]> {
  const tags = await prisma.emailTag.findMany({
    where: { advertiserId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { contactTags: true } },
    },
  });

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
    contactCount: tag._count.contactTags,
    createdAt: tag.createdAt,
  }));
}

export async function createEmailTag(
  advertiserId: string,
  data: { name: string; color?: string | null },
) {
  const name = normalizeTagName(data.name);
  if (name.length < 1 || name.length > 40) {
    throw new AppError("VALIDATION_ERROR", "Tag name must be 1–40 characters", 422);
  }

  const existing = await prisma.emailTag.findUnique({
    where: {
      advertiserId_name: { advertiserId, name },
    },
  });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", "A tag with this name already exists", 422);
  }

  return prisma.emailTag.create({
    data: {
      advertiserId,
      name,
      color: data.color?.trim() || null,
    },
  });
}

export async function updateEmailTag(
  advertiserId: string,
  id: string,
  data: { name?: string; color?: string | null },
) {
  await assertTagOwned(advertiserId, id);

  const nextName =
    data.name !== undefined ? normalizeTagName(data.name) : undefined;
  if (nextName !== undefined && (nextName.length < 1 || nextName.length > 40)) {
    throw new AppError("VALIDATION_ERROR", "Tag name must be 1–40 characters", 422);
  }

  if (nextName) {
    const clash = await prisma.emailTag.findUnique({
      where: {
        advertiserId_name: { advertiserId, name: nextName },
      },
    });
    if (clash && clash.id !== id) {
      throw new AppError("VALIDATION_ERROR", "A tag with this name already exists", 422);
    }
  }

  return prisma.emailTag.update({
    where: { id },
    data: {
      ...(nextName !== undefined ? { name: nextName } : {}),
      ...(data.color !== undefined
        ? { color: data.color?.trim() || null }
        : {}),
    },
  });
}

export async function deleteEmailTag(advertiserId: string, id: string) {
  await assertTagOwned(advertiserId, id);
  await prisma.emailTag.delete({ where: { id } });
  return { id };
}

export async function attachTagToContact(
  advertiserId: string,
  tagId: string,
  contactId: string,
) {
  await assertTagOwned(advertiserId, tagId);
  await assertContactOwned(advertiserId, contactId);

  await prisma.emailContactTag.upsert({
    where: {
      contactId_tagId: { contactId, tagId },
    },
    create: { contactId, tagId },
    update: {},
  });

  return { tagId, contactId };
}

export async function detachTagFromContact(
  advertiserId: string,
  tagId: string,
  contactId: string,
) {
  await assertTagOwned(advertiserId, tagId);
  await assertContactOwned(advertiserId, contactId);

  await prisma.emailContactTag.deleteMany({
    where: { contactId, tagId },
  });

  return { tagId, contactId };
}
