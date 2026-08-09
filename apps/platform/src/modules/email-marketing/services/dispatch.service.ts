import { prisma } from "@/lib/prisma";
import { EMAIL_MARKETING_CONFIG_KEY } from "@/lib/email/email-marketing-settings";
import { parseEmailMarketingConfig } from "../config/platform-config";
import { upsertContactFromLead } from "./contact.service";
import { enqueueEmailSend } from "../queue/email-queue";

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
      campaignId: lead.campaign.id,
    },
    include: {
      steps: { orderBy: { order: "asc" }, include: { template: true } },
    },
  });

  const baseTime = new Date();
  const advertiserId = lead.campaign.advertiserId;

  for (const automation of automations) {
    for (const step of automation.steps) {
      if (step.type !== "SEND_EMAIL" || !step.templateId) continue;

      const scheduledAt = new Date(baseTime.getTime() + step.delayMinutes * 60_000);

      const existing = await prisma.emailSend.findFirst({
        where: {
          automationId: automation.id,
          stepId: step.id,
          leadId: lead.id,
        },
      });

      if (existing) continue;

      const send = await prisma.emailSend.create({
        data: {
          advertiserId,
          contactId: contact.id,
          automationId: automation.id,
          stepId: step.id,
          leadId: lead.id,
          templateId: step.templateId,
          status: "QUEUED",
          scheduledAt,
        },
      });

      await enqueueEmailSend(send.id, scheduledAt);
    }
  }
}
