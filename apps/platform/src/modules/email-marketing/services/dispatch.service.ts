import { prisma } from "@/lib/prisma";
import { EMAIL_MARKETING_CONFIG_KEY } from "@/lib/email/email-marketing-settings";
import { parseEmailMarketingConfig } from "../config/platform-config";
import { upsertContactFromLead } from "./contact.service";
import { enqueueEmailSend } from "../queue/email-queue";

type AutomationWithSteps = {
  id: string;
  advertiserId: string;
  steps: Array<{
    id: string;
    type: string;
    templateId: string | null;
    delayMinutes: number;
  }>;
};

async function queueAutomationStepsForContact(input: {
  automation: AutomationWithSteps;
  advertiserId: string;
  contactId: string;
  leadId: string | null;
  baseTime: Date;
}): Promise<number> {
  let queued = 0;

  for (const step of input.automation.steps) {
    if (step.type !== "SEND_EMAIL" || !step.templateId) continue;

    const scheduledAt = new Date(input.baseTime.getTime() + step.delayMinutes * 60_000);

    const existing = await prisma.emailSend.findFirst({
      where: input.leadId
        ? {
            automationId: input.automation.id,
            stepId: step.id,
            leadId: input.leadId,
          }
        : {
            automationId: input.automation.id,
            stepId: step.id,
            contactId: input.contactId,
          },
    });

    if (existing) continue;

    const send = await prisma.emailSend.create({
      data: {
        advertiserId: input.advertiserId,
        contactId: input.contactId,
        automationId: input.automation.id,
        stepId: step.id,
        leadId: input.leadId,
        templateId: step.templateId,
        status: "QUEUED",
        scheduledAt,
      },
    });

    await enqueueEmailSend(send.id, scheduledAt);
    queued += 1;
  }

  return queued;
}

export async function backfillAutomationForExistingContacts(automationId: string) {
  const platformRow = await prisma.platformSetting.findUnique({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
  });
  const platformConfig = parseEmailMarketingConfig(platformRow?.value);
  if (!platformConfig.enabled) return { queuedSends: 0, contacts: 0 };

  const automation = await prisma.emailAutomation.findUnique({
    where: { id: automationId },
    include: {
      steps: { orderBy: { order: "asc" }, include: { template: true } },
    },
  });

  if (!automation || automation.status !== "ACTIVE" || !automation.campaignId) {
    return { queuedSends: 0, contacts: 0 };
  }

  const contacts = await prisma.emailContact.findMany({
    where: {
      advertiserId: automation.advertiserId,
      sourceCampaignId: automation.campaignId,
      status: "SUBSCRIBED",
    },
    select: { id: true, sourceLeadId: true },
  });

  const baseTime = new Date();
  let queuedSends = 0;

  for (const contact of contacts) {
    queuedSends += await queueAutomationStepsForContact({
      automation,
      advertiserId: automation.advertiserId,
      contactId: contact.id,
      leadId: contact.sourceLeadId,
      baseTime,
    });
  }

  return { queuedSends, contacts: contacts.length };
}

export async function dispatchLeadEmailAutomations(input: {
  leadId: string;
  event: "LEAD_CAPTURED" | "LEAD_APPROVED";
}) {
  const platformRow = await prisma.platformSetting.findUnique({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
  });
  const platformConfig = parseEmailMarketingConfig(platformRow?.value);
  if (!platformConfig.enabled) return;

  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: {
      campaign: {
        select: {
          id: true,
          name: true,
          advertiserId: true,
          advertiser: {
            select: {
              id: true,
              name: true,
              email: true,
              advertiserProfile: { select: { company: true } },
            },
          },
        },
      },
    },
  });

  if (!lead) return;
  if (lead.status === "REJECTED") return;
  if (input.event === "LEAD_APPROVED" && !["APPROVED", "PAID"].includes(lead.status)) return;

  const leadData =
    lead.data && typeof lead.data === "object" && !Array.isArray(lead.data)
      ? (lead.data as Record<string, unknown>)
      : {};

  const contact = await upsertContactFromLead({
    advertiserId: lead.campaign.advertiserId,
    leadId: lead.id,
    campaignId: lead.campaign.id,
    data: leadData,
    consentSource: lead.source === "optin" ? "optin_page" : "lead_capture",
  });

  if (!contact || contact.status !== "SUBSCRIBED") return;

  const automations = await prisma.emailAutomation.findMany({
    where: {
      advertiserId: lead.campaign.advertiserId,
      status: "ACTIVE",
      trigger: input.event,
      OR: [
        { campaignId: lead.campaign.id },
        {
          list: {
            campaigns: {
              some: { campaignId: lead.campaign.id },
            },
          },
        },
      ],
    },
    include: {
      steps: { orderBy: { order: "asc" }, include: { template: true } },
    },
  });

  const baseTime = new Date();
  const advertiserId = lead.campaign.advertiserId;

  for (const automation of automations) {
    await queueAutomationStepsForContact({
      automation,
      advertiserId,
      contactId: contact.id,
      leadId: lead.id,
      baseTime,
    });
  }
}
