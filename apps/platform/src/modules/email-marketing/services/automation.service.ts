import type {
  AutoresponderTrigger,
  EmailAutomationStatus,
  EmailAutomationStepType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { EMAIL_MARKETING_CONFIG_KEY } from "@/lib/email/ses-settings";
import { parseEmailMarketingConfig } from "../config/platform-config";

export type AutomationStepInput = {
  id?: string;
  type?: EmailAutomationStepType;
  templateId?: string | null;
  tagId?: string | null;
  delayMinutes: number;
  order: number;
  fromName?: string | null;
  fromEmail?: string | null;
};

const stepInclude = {
  orderBy: { order: "asc" as const },
  include: {
    template: true,
    tag: { select: { id: true, name: true, color: true } },
  },
};

async function assertStepsValid(
  advertiserId: string,
  steps: AutomationStepInput[],
) {
  if (!steps.length) {
    throw new AppError("VALIDATION_ERROR", "At least one step is required", 422);
  }

  for (const step of steps) {
    const type = step.type ?? "SEND_EMAIL";
    if (type !== "SEND_EMAIL") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Only email steps are supported.",
        422,
      );
    }
    if (!step.templateId) {
      throw new AppError("VALIDATION_ERROR", "Email steps require a template", 422);
    }
    const template = await prisma.emailTemplate.findFirst({
      where: { id: step.templateId, advertiserId },
    });
    if (!template) {
      throw new AppError("NOT_FOUND", `Template ${step.templateId} not found`, 404);
    }
  }
}

async function assertEngagementTagsValid(
  advertiserId: string,
  openTagId?: string | null,
  clickTagId?: string | null,
) {
  for (const [label, tagId] of [
    ["open", openTagId],
    ["click", clickTagId],
  ] as const) {
    const id = tagId?.trim();
    if (!id) continue;
    const tag = await prisma.emailTag.findFirst({
      where: { id, advertiserId },
    });
    if (!tag) {
      throw new AppError("NOT_FOUND", `${label} tag not found`, 404);
    }
  }
}

function toStepCreateData(s: AutomationStepInput) {
  return {
    order: s.order,
    type: "SEND_EMAIL" as const,
    delayMinutes: s.delayMinutes,
    templateId: s.templateId!,
    tagId: null as string | null,
    fromName: s.fromName?.trim() || null,
    fromEmail: s.fromEmail?.trim() || null,
  };
}

function normalizeTagId(value?: string | null) {
  const id = value?.trim();
  return id ? id : null;
}

export async function listAutomations(advertiserId: string) {
  return prisma.emailAutomation.findMany({
    where: { advertiserId },
    orderBy: { updatedAt: "desc" },
    include: {
      steps: {
        orderBy: { order: "asc" },
        include: {
          template: { select: { id: true, name: true, subject: true } },
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      _count: { select: { sends: true } },
    },
  });
}

export async function getAutomation(advertiserId: string, id: string) {
  const automation = await prisma.emailAutomation.findFirst({
    where: { id, advertiserId },
    include: {
      steps: stepInclude,
    },
  });
  if (!automation) throw new AppError("NOT_FOUND", "Automation not found", 404);
  return automation;
}

async function getMaxAutomations(): Promise<number> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
  });
  const config = parseEmailMarketingConfig(row?.value);
  return config.maxAutomationsPerAdvertiser;
}

export async function createAutomation(
  advertiserId: string,
  data: {
    name: string;
    trigger: AutoresponderTrigger;
    campaignId?: string | null;
    fromName: string;
    replyTo?: string | null;
    openTagId?: string | null;
    clickTagId?: string | null;
    steps: AutomationStepInput[];
  },
) {
  const count = await prisma.emailAutomation.count({ where: { advertiserId } });
  const max = await getMaxAutomations();
  if (count >= max) {
    throw new AppError(
      "LIMIT_REACHED",
      `Maximum ${max} automations allowed.`,
      422,
    );
  }

  if (data.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: data.campaignId, advertiserId },
    });
    if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found", 404);
  }

  await assertStepsValid(advertiserId, data.steps);
  await assertEngagementTagsValid(advertiserId, data.openTagId, data.clickTagId);

  return prisma.emailAutomation.create({
    data: {
      advertiserId,
      name: data.name,
      trigger: data.trigger,
      campaignId: data.campaignId ?? null,
      fromName: data.fromName,
      replyTo: data.replyTo ?? null,
      openTagId: normalizeTagId(data.openTagId),
      clickTagId: normalizeTagId(data.clickTagId),
      status: "DRAFT",
      steps: {
        create: data.steps.map((s) => toStepCreateData(s)),
      },
    },
    include: {
      steps: stepInclude,
    },
  });
}

export async function updateAutomation(
  advertiserId: string,
  id: string,
  data: Partial<{
    name: string;
    trigger: AutoresponderTrigger;
    campaignId: string | null;
    fromName: string;
    replyTo: string | null;
    openTagId: string | null;
    clickTagId: string | null;
    status: EmailAutomationStatus;
    steps: AutomationStepInput[];
  }>,
) {
  const existing = await getAutomation(advertiserId, id);

  if (data.status === "ACTIVE" && !(data.campaignId !== undefined ? data.campaignId : existing.campaignId)) {
    throw new AppError("VALIDATION_ERROR", "Select a list before activating", 422);
  }

  if (data.steps) {
    await assertStepsValid(advertiserId, data.steps);

    await prisma.$transaction(async (tx) => {
      const current = await tx.emailAutomationStep.findMany({
        where: { automationId: id },
      });
      const currentById = new Map(current.map((s) => [s.id, s]));
      const keepIds = new Set(
        data.steps!
          .map((s) => s.id)
          .filter((stepId): stepId is string => Boolean(stepId && currentById.has(stepId))),
      );

      for (const step of current) {
        await tx.emailAutomationStep.update({
          where: { id: step.id },
          data: { order: step.order + 10_000 },
        });
      }

      for (const step of data.steps!) {
        const payload = toStepCreateData(step);
        if (step.id && currentById.has(step.id)) {
          await tx.emailAutomationStep.update({
            where: { id: step.id },
            data: payload,
          });
        } else {
          await tx.emailAutomationStep.create({
            data: {
              automationId: id,
              ...payload,
            },
          });
        }
      }

      const deleteIds = current.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
      if (deleteIds.length) {
        await tx.emailAutomationStep.deleteMany({
          where: { id: { in: deleteIds } },
        });
      }
    });
  }

  if (data.openTagId !== undefined || data.clickTagId !== undefined) {
    await assertEngagementTagsValid(
      advertiserId,
      data.openTagId !== undefined ? data.openTagId : existing.openTagId,
      data.clickTagId !== undefined ? data.clickTagId : existing.clickTagId,
    );
  }

  if (data.status === "PAUSED") {
    await pauseQueuedSends(id);
  }

  return prisma.emailAutomation.update({
    where: { id },
    data: {
      name: data.name ?? existing.name,
      trigger: data.trigger ?? existing.trigger,
      campaignId: data.campaignId !== undefined ? data.campaignId : existing.campaignId,
      fromName: data.fromName ?? existing.fromName,
      replyTo: data.replyTo !== undefined ? data.replyTo : existing.replyTo,
      openTagId:
        data.openTagId !== undefined ? normalizeTagId(data.openTagId) : existing.openTagId,
      clickTagId:
        data.clickTagId !== undefined ? normalizeTagId(data.clickTagId) : existing.clickTagId,
      status: data.status ?? existing.status,
    },
    include: {
      steps: stepInclude,
    },
  });
}

async function pauseQueuedSends(automationId: string) {
  await prisma.emailSend.updateMany({
    where: { automationId, status: "QUEUED" },
    data: { status: "FAILED", error: "Automation paused" },
  });
}

export async function pauseAutomation(advertiserId: string, id: string) {
  await getAutomation(advertiserId, id);
  await pauseQueuedSends(id);
  return prisma.emailAutomation.update({
    where: { id },
    data: { status: "PAUSED" },
    include: {
      steps: stepInclude,
    },
  });
}

export async function activateAutomation(advertiserId: string, id: string) {
  const automation = await getAutomation(advertiserId, id);
  if (!automation.steps.length) {
    throw new AppError("VALIDATION_ERROR", "Add at least one step before activating", 422);
  }
  if (!automation.campaignId) {
    throw new AppError("VALIDATION_ERROR", "Select a list before publishing", 422);
  }
  for (const step of automation.steps) {
    if (step.type === "SEND_EMAIL" && !step.templateId) {
      throw new AppError("VALIDATION_ERROR", "Every email step needs a template", 422);
    }
    if (step.type !== "SEND_EMAIL") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Only email steps are supported",
        422,
      );
    }
  }
  return prisma.emailAutomation.update({
    where: { id },
    data: { status: "ACTIVE" },
    include: {
      steps: stepInclude,
    },
  });
}

export async function deleteAutomation(advertiserId: string, id: string) {
  await getAutomation(advertiserId, id);
  await prisma.emailAutomation.delete({ where: { id } });
}
