import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { enqueueEmailSend, removeEmailSendJob } from "../queue/email-queue";
import { createTemplate, updateTemplate } from "./template.service";
import { findVerifiedSendingMailbox } from "./identity.service";

export type BroadcastAudienceType = "LIST" | "TAGS";
export type BroadcastAction = "draft" | "schedule" | "send";

export type BroadcastInput = {
  name: string;
  audienceType: BroadcastAudienceType;
  listId?: string | null;
  tagIds?: string[] | null;
  templateId?: string | null;
  subject?: string | null;
  htmlBody?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  action: BroadcastAction;
  scheduledAt?: string | null;
};

/** @deprecated use BroadcastInput — kept for rename clarity in callers */
export type CreateBroadcastInput = BroadcastInput;

function asTagIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
}

function assertAudienceXor(input: BroadcastInput) {
  if (input.audienceType === "LIST" && (input.tagIds?.length ?? 0) > 0) {
    throw new AppError("VALIDATION_ERROR", "Choose a list or tags, not both", 422);
  }
  if (input.audienceType === "TAGS" && input.listId) {
    throw new AppError("VALIDATION_ERROR", "Choose a list or tags, not both", 422);
  }
}

/** Persist override; empty means use Settings default at send time. */
async function resolveBroadcastSenderFields(
  advertiserId: string,
  input: BroadcastInput,
  requireResolved: boolean,
): Promise<{ fromEmail: string | null; fromName: string | null }> {
  const fromEmailRaw = input.fromEmail?.trim().toLowerCase() || null;
  const fromNameRaw = input.fromName?.trim() || null;

  if (fromEmailRaw) {
    const mailbox = await findVerifiedSendingMailbox(advertiserId, fromEmailRaw);
    if (!mailbox) {
      throw new AppError(
        "VALIDATION_ERROR",
        "From email must match a verified sending domain address",
        422,
      );
    }
    return {
      fromEmail: mailbox.email,
      fromName: fromNameRaw || mailbox.fromName || mailbox.identity.fromName || null,
    };
  }

  if (requireResolved) {
    const settings = await prisma.advertiserEmailSettings.findUnique({
      where: { advertiserId },
    });
    const settingsFrom = settings?.fromEmail?.trim().toLowerCase() || "";
    if (!settingsFrom) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Select a from email or set a default on Email Settings",
        422,
      );
    }
    const mailbox = await findVerifiedSendingMailbox(advertiserId, settingsFrom);
    if (!mailbox) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Default from email on Settings is not a verified domain address",
        422,
      );
    }
  }

  return { fromEmail: null, fromName: fromNameRaw };
}

async function resolveAudienceContactIds(
  advertiserId: string,
  audienceType: BroadcastAudienceType,
  listId?: string | null,
  tagIds?: string[] | null,
  opts?: { soft?: boolean },
) {
  if (audienceType === "LIST") {
    if (!listId?.trim()) {
      if (opts?.soft) {
        return {
          contactIds: [] as string[],
          listId: null,
          tagIds: [] as string[],
          allSubscribers: false,
        };
      }
      throw new AppError("VALIDATION_ERROR", "Select a list", 422);
    }

    if (listId === "all") {
      const contacts = await prisma.emailContact.findMany({
        where: { advertiserId, status: "SUBSCRIBED" },
        select: { id: true },
      });
      return {
        contactIds: contacts.map((c) => c.id),
        listId: null,
        tagIds: [] as string[],
        allSubscribers: true,
      };
    }

    const list = await prisma.emailList.findFirst({
      where: { id: listId, advertiserId },
    });
    if (!list) {
      if (opts?.soft) {
        return {
          contactIds: [] as string[],
          listId: null,
          tagIds: [] as string[],
          allSubscribers: false,
        };
      }
      throw new AppError("NOT_FOUND", "List not found", 404);
    }

    const contacts = await prisma.emailContact.findMany({
      where: {
        advertiserId,
        status: "SUBSCRIBED",
        sourceCampaignId: list.campaignId,
      },
      select: { id: true },
    });
    return {
      contactIds: contacts.map((c) => c.id),
      listId: list.id,
      tagIds: [] as string[],
      allSubscribers: false,
    };
  }

  const ids = [...new Set((tagIds ?? []).map((t) => t.trim()).filter(Boolean))];
  if (!ids.length) {
    if (opts?.soft) {
      return {
        contactIds: [] as string[],
        listId: null,
        tagIds: [] as string[],
        allSubscribers: false,
      };
    }
    throw new AppError("VALIDATION_ERROR", "Select at least one tag", 422);
  }

  const owned = await prisma.emailTag.findMany({
    where: { advertiserId, id: { in: ids } },
    select: { id: true },
  });
  if (owned.length !== ids.length) {
    if (opts?.soft) {
      return {
        contactIds: [] as string[],
        listId: null,
        tagIds: ids,
        allSubscribers: false,
      };
    }
    throw new AppError("NOT_FOUND", "One or more tags were not found", 404);
  }

  const contacts = await prisma.emailContact.findMany({
    where: {
      advertiserId,
      status: "SUBSCRIBED",
      contactTags: { some: { tagId: { in: ids } } },
    },
    select: { id: true },
  });
  return {
    contactIds: contacts.map((c) => c.id),
    listId: null as string | null,
    tagIds: ids,
    allSubscribers: false,
  };
}

async function resolveTemplateId(
  advertiserId: string,
  input: BroadcastInput,
  existingTemplateId?: string | null,
) {
  let templateId = input.templateId?.trim() || "";
  if (templateId) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: templateId, advertiserId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Template not found", 404);
    return templateId;
  }

  const subject = input.subject?.trim() ?? "";
  const htmlBody = input.htmlBody?.trim() ?? "";
  if (subject.length < 2) {
    throw new AppError("VALIDATION_ERROR", "Subject is required", 422);
  }
  if (htmlBody.length < 10) {
    throw new AppError("VALIDATION_ERROR", "Email body is required", 422);
  }

  const name = input.name.trim();
  if (existingTemplateId) {
    const existing = await prisma.emailTemplate.findFirst({
      where: { id: existingTemplateId, advertiserId },
      select: { id: true, name: true },
    });
    if (existing?.name.startsWith("[Broadcast]")) {
      await updateTemplate(advertiserId, existing.id, { subject, htmlBody });
      return existing.id;
    }
  }

  const created = await createTemplate(advertiserId, {
    name: `[Broadcast] ${name}`.slice(0, 80),
    subject,
    htmlBody,
  });
  return created.id;
}

function parseScheduleAt(action: BroadcastAction, scheduledAt?: string | null): Date | null {
  if (action === "draft") return null;
  if (action === "send") return new Date();
  if (!scheduledAt?.trim()) {
    throw new AppError("VALIDATION_ERROR", "Pick a schedule date and time", 422);
  }
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid schedule date", 422);
  }
  if (when.getTime() <= Date.now() + 30_000) {
    throw new AppError("VALIDATION_ERROR", "Schedule time must be at least 1 minute in the future", 422);
  }
  return when;
}

function serializeBroadcast(b: {
  id: string;
  name: string;
  audienceType: BroadcastAudienceType;
  listId: string | null;
  allSubscribers: boolean;
  list?: { id: string; name: string } | null;
  tagIds: unknown;
  fromEmail?: string | null;
  fromName?: string | null;
  status: string;
  scheduledAt: Date | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
  updatedAt: Date;
  template: { id: string; name: string; subject: string; htmlBody?: string };
  _count?: { sends: number };
}) {
  const listIdOut =
    b.audienceType === "LIST" && b.allSubscribers ? "all" : b.listId;
  return {
    id: b.id,
    name: b.name,
    audienceType: b.audienceType,
    listId: listIdOut,
    listName:
      b.list?.name ??
      (b.audienceType === "LIST" && b.allSubscribers ? "All Subscribers" : null),
    tagIds: asTagIdArray(b.tagIds),
    fromEmail: b.fromEmail ?? null,
    fromName: b.fromName ?? null,
    status: b.status,
    scheduledAt: b.scheduledAt?.toISOString() ?? null,
    recipientCount: b.recipientCount,
    sentCount: b.sentCount,
    failedCount: b.failedCount,
    template: {
      id: b.template.id,
      name: b.template.name,
      subject: b.template.subject,
      ...(b.template.htmlBody !== undefined ? { htmlBody: b.template.htmlBody } : {}),
    },
    sendCount: b._count?.sends,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

async function clearBroadcastSends(broadcastId: string) {
  const sends = await prisma.emailSend.findMany({
    where: { broadcastId },
    select: { id: true, status: true },
  });
  for (const send of sends) {
    if (send.status === "QUEUED") {
      await removeEmailSendJob(send.id);
    }
  }
  if (sends.length) {
    await prisma.emailSend.deleteMany({ where: { broadcastId } });
  }
}

async function queueBroadcastSends(
  advertiserId: string,
  broadcastId: string,
  templateId: string,
  contactIds: string[],
  scheduledAt: Date,
  markSending: boolean,
) {
  const sends = await prisma.$transaction(
    contactIds.map((contactId) =>
      prisma.emailSend.create({
        data: {
          advertiserId,
          contactId,
          templateId,
          broadcastId,
          status: "QUEUED",
          scheduledAt,
        },
      }),
    ),
  );

  await prisma.emailBroadcast.update({
    where: { id: broadcastId },
    data: {
      status: markSending ? "SENDING" : "QUEUED",
      scheduledAt,
      recipientCount: contactIds.length,
      sentCount: 0,
      failedCount: 0,
    },
  });

  for (const send of sends) {
    try {
      await enqueueEmailSend(send.id, scheduledAt);
    } catch (err) {
      console.error(
        `[broadcast] enqueue failed send=${send.id}:`,
        err instanceof Error ? err.message : err,
      );
      await prisma.emailSend.update({
        where: { id: send.id },
        data: { status: "FAILED", error: "Failed to enqueue" },
      });
    }
  }

  await refreshBroadcastProgress(broadcastId).catch(() => {});
}

async function applyBroadcastAction(
  advertiserId: string,
  broadcastId: string | null,
  input: BroadcastInput,
) {
  assertAudienceXor(input);

  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new AppError("VALIDATION_ERROR", "Name must be 2–80 characters", 422);
  }

  const action = input.action;
  const when = parseScheduleAt(action, input.scheduledAt);

  let existing: {
    id: string;
    status: string;
    templateId: string;
    sentCount: number;
  } | null = null;

  if (broadcastId) {
    existing = await prisma.emailBroadcast.findFirst({
      where: { id: broadcastId, advertiserId },
      select: { id: true, status: true, templateId: true, sentCount: true },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Broadcast not found", 404);
    const editable =
      existing.status === "DRAFT" ||
      existing.status === "QUEUED" ||
      (existing.status === "FAILED" && existing.sentCount === 0);
    if (!editable) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Only draft, scheduled, or failed (unsent) broadcasts can be edited",
        422,
      );
    }
  }

  const templateId = await resolveTemplateId(
    advertiserId,
    input,
    existing?.templateId,
  );

  const soft = action === "draft";
  const sender = await resolveBroadcastSenderFields(advertiserId, input, !soft);
  const { contactIds, listId, tagIds, allSubscribers } = await resolveAudienceContactIds(
    advertiserId,
    input.audienceType,
    input.listId,
    input.tagIds,
    { soft },
  );

  if (action !== "draft" && !contactIds.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No subscribed recipients match this audience",
      422,
    );
  }

  const audienceData = {
    name,
    templateId,
    audienceType: input.audienceType,
    listId,
    tagIds: (tagIds.length ? tagIds : Prisma.DbNull) as
      | Prisma.InputJsonValue
      | typeof Prisma.DbNull,
    allSubscribers,
    recipientCount: contactIds.length,
    fromEmail: sender.fromEmail,
    fromName: sender.fromName,
  };

  if (action === "draft") {
    if (existing) {
      await clearBroadcastSends(existing.id);
      await prisma.emailBroadcast.update({
        where: { id: existing.id },
        data: {
          ...audienceData,
          status: "DRAFT",
          scheduledAt: null,
          sentCount: 0,
          failedCount: 0,
        },
      });
      return getBroadcast(advertiserId, existing.id);
    }

    const created = await prisma.emailBroadcast.create({
      data: {
        advertiserId,
        ...audienceData,
        status: "DRAFT",
        scheduledAt: null,
      },
    });
    return getBroadcast(advertiserId, created.id);
  }

  // schedule or send
  if (existing) {
    await clearBroadcastSends(existing.id);
    await prisma.emailBroadcast.update({
      where: { id: existing.id },
      data: {
        ...audienceData,
        status: "QUEUED",
        scheduledAt: when!,
      },
    });
    await queueBroadcastSends(
      advertiserId,
      existing.id,
      templateId,
      contactIds,
      when!,
      action === "send",
    );
    return getBroadcast(advertiserId, existing.id);
  }

  const created = await prisma.emailBroadcast.create({
    data: {
      advertiserId,
      ...audienceData,
      status: "QUEUED",
      scheduledAt: when!,
    },
  });
  await queueBroadcastSends(
    advertiserId,
    created.id,
    templateId,
    contactIds,
    when!,
    action === "send",
  );
  return getBroadcast(advertiserId, created.id);
}

export async function listBroadcasts(advertiserId: string) {
  const rows = await prisma.emailBroadcast.findMany({
    where: { advertiserId },
    orderBy: { createdAt: "desc" },
    include: {
      template: { select: { id: true, name: true, subject: true } },
      list: { select: { id: true, name: true } },
      _count: { select: { sends: true } },
    },
  });

  return rows.map((b) => serializeBroadcast(b));
}

export async function getBroadcast(advertiserId: string, id: string) {
  const b = await prisma.emailBroadcast.findFirst({
    where: { id, advertiserId },
    include: {
      template: { select: { id: true, name: true, subject: true, htmlBody: true } },
      list: { select: { id: true, name: true } },
      _count: { select: { sends: true } },
    },
  });
  if (!b) throw new AppError("NOT_FOUND", "Broadcast not found", 404);
  return serializeBroadcast(b);
}

export async function previewBroadcastAudience(
  advertiserId: string,
  input: Pick<BroadcastInput, "audienceType" | "listId" | "tagIds">,
) {
  const { contactIds } = await resolveAudienceContactIds(
    advertiserId,
    input.audienceType,
    input.listId,
    input.tagIds,
    { soft: true },
  );
  return { recipientCount: contactIds.length };
}

export async function createBroadcast(advertiserId: string, input: BroadcastInput) {
  return applyBroadcastAction(advertiserId, null, input);
}

/** @deprecated alias — prefer createBroadcast */
export async function createAndSendBroadcast(
  advertiserId: string,
  input: BroadcastInput,
) {
  return createBroadcast(advertiserId, {
    ...input,
    action: input.action ?? "send",
  });
}

export async function updateBroadcast(
  advertiserId: string,
  id: string,
  input: BroadcastInput,
) {
  return applyBroadcastAction(advertiserId, id, input);
}

/** Mark broadcast SENT/FAILED/SENDING/QUEUED from current send rows. */
export async function refreshBroadcastProgress(broadcastId: string) {
  const broadcast = await prisma.emailBroadcast.findUnique({
    where: { id: broadcastId },
    select: { scheduledAt: true },
  });

  const [total, sent, failed, queued] = await Promise.all([
    prisma.emailSend.count({ where: { broadcastId } }),
    prisma.emailSend.count({
      where: { broadcastId, status: { in: ["SENT", "DELIVERED"] } },
    }),
    prisma.emailSend.count({
      where: { broadcastId, status: { in: ["FAILED", "BOUNCED"] } },
    }),
    prisma.emailSend.count({ where: { broadcastId, status: "QUEUED" } }),
  ]);

  const stillScheduled =
    Boolean(broadcast?.scheduledAt) &&
    broadcast!.scheduledAt!.getTime() > Date.now() &&
    sent === 0;

  const status = stillScheduled
    ? "QUEUED"
    : queued > 0
      ? "SENDING"
      : failed === total && total > 0
        ? "FAILED"
        : "SENT";

  await prisma.emailBroadcast.update({
    where: { id: broadcastId },
    data: {
      sentCount: sent,
      failedCount: failed,
      recipientCount: total,
      status,
    },
  });
}
