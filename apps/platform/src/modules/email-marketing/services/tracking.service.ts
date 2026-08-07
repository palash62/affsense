import type { EmailEventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyTrackingToken } from "../lib/tokens";
import { attachTagToContact } from "./tag.service";

async function applyAutomationEngagementTag(
  sendId: string,
  kind: "open" | "click",
) {
  const send = await prisma.emailSend.findUnique({
    where: { id: sendId },
    select: {
      advertiserId: true,
      contactId: true,
      automationId: true,
      automation: {
        select: {
          openTagId: true,
          clickTagId: true,
        },
      },
    },
  });
  if (!send?.automationId || !send.automation) return;

  const tagId =
    kind === "open" ? send.automation.openTagId : send.automation.clickTagId;
  if (!tagId) return;

  try {
    await attachTagToContact(send.advertiserId, tagId, send.contactId);
  } catch (err) {
    console.error(
      `[email-track] apply ${kind} tag failed send=${sendId} tag=${tagId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function recordOpen(sendId: string, token: string) {
  if (!verifyTrackingToken(sendId, token)) return false;

  const send = await prisma.emailSend.findUnique({ where: { id: sendId } });
  if (!send) return false;

  const existing = await prisma.emailEvent.findFirst({
    where: { sendId, type: "OPEN" },
  });
  if (!existing) {
    await prisma.emailEvent.create({
      data: { sendId, type: "OPEN" },
    });
  }
  // Idempotent — upserts contact tag so subscriber count moves even if a prior attach failed.
  await applyAutomationEngagementTag(sendId, "open");
  return true;
}

export async function recordClick(sendId: string, token: string, url: string) {
  if (!verifyTrackingToken(sendId, token)) return null;

  const send = await prisma.emailSend.findUnique({ where: { id: sendId } });
  if (!send) return null;

  await prisma.emailEvent.create({
    data: { sendId, type: "CLICK", metadata: { url } as Prisma.InputJsonValue },
  });

  // Idempotent attach — first or later clicks all upsert the same contact↔tag row.
  await applyAutomationEngagementTag(sendId, "click");

  return url;
}

export async function recordSesEvent(
  sendId: string | null,
  type: EmailEventType,
  metadata?: Record<string, unknown>,
) {
  if (!sendId) return;

  const send = await prisma.emailSend.findFirst({
    where: { sesMessageId: sendId },
  });
  if (!send) return;

  if (type === "OPEN") {
    const existing = await prisma.emailEvent.findFirst({
      where: { sendId: send.id, type: "OPEN" },
    });
    if (!existing) {
      await prisma.emailEvent.create({
        data: { sendId: send.id, type: "OPEN" },
      });
    }
    await applyAutomationEngagementTag(send.id, "open");
    return;
  }

  if (type === "CLICK") {
    await prisma.emailEvent.create({
      data: {
        sendId: send.id,
        type: "CLICK",
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
    await applyAutomationEngagementTag(send.id, "click");
    return;
  }

  await prisma.emailEvent.create({
    data: { sendId: send.id, type, metadata: metadata as Prisma.InputJsonValue | undefined },
  });

  if (type === "BOUNCE") {
    await prisma.emailSend.update({
      where: { id: send.id },
      data: { status: "BOUNCED" },
    });
    await prisma.emailContact.update({
      where: { id: send.contactId },
      data: { status: "BOUNCED" },
    });
  }

  if (type === "COMPLAINT") {
    await prisma.emailContact.update({
      where: { id: send.contactId },
      data: { status: "COMPLAINED" },
    });
  }

  if (type === "DELIVERY") {
    await prisma.emailSend.update({
      where: { id: send.id },
      data: { status: "DELIVERED" },
    });
  }
}
