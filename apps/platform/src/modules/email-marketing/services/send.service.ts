import { prisma } from "@/lib/prisma";
import { PLATFORM_EMAILS } from "@/lib/email/addresses";
import { getResolvedSesConfig } from "@/services/ses-settings.service";
import { EMAIL_MARKETING_CONFIG_KEY } from "@/lib/email/ses-settings";
import { parseEmailMarketingConfig } from "../config/platform-config";
import {
  appendUnsubscribeFooter,
  injectTrackingPixel,
  renderTemplate,
  wrapLinksForTracking,
} from "../lib/render-template";
import { signTrackingToken } from "../lib/tokens";
import { sendMarketingEmail } from "./ses-sender.service";
import { MAX_SEND_ATTEMPTS } from "../config/defaults";
import { refreshBroadcastProgress } from "./broadcast.service";
import {
  findVerifiedSendingMailbox,
  listVerifiedSendingMailboxes,
} from "./identity.service";

async function maybeRefreshBroadcast(broadcastId: string | null | undefined) {
  if (!broadcastId) return;
  await refreshBroadcastProgress(broadcastId).catch(() => {});
}

async function resolveVerifiedMailbox(
  advertiserId: string,
  candidateFromEmail: string,
) {
  if (candidateFromEmail) {
    const exact = await findVerifiedSendingMailbox(advertiserId, candidateFromEmail);
    if (exact) return exact;
  }

  const mailboxes = await listVerifiedSendingMailboxes(advertiserId);
  if (mailboxes.length === 0) return null;
  return mailboxes.find((m) => m.isDefault) ?? mailboxes[0];
}

export async function processEmailSend(sendId: string) {
  const send = await prisma.emailSend.findUnique({
    where: { id: sendId },
    include: {
      contact: true,
      template: true,
      automation: true,
      step: true,
      broadcast: true,
      lead: {
        include: {
          campaign: { select: { name: true } },
        },
      },
    },
  });

  if (!send) return;
  if (send.status !== "QUEUED" && send.status !== "FAILED") return;
  if (send.automation?.status === "PAUSED" || send.automation?.status === "DRAFT") {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: { status: "FAILED", error: "Automation is not active" },
    });
    await maybeRefreshBroadcast(send.broadcastId);
    return;
  }
  if (send.contact.status !== "SUBSCRIBED") {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: { status: "FAILED", error: "Contact not subscribed" },
    });
    await maybeRefreshBroadcast(send.broadcastId);
    return;
  }

  const settings = await prisma.advertiserEmailSettings.findUnique({
    where: { advertiserId: send.advertiserId },
  });

  const advertiser = await prisma.user.findUnique({
    where: { id: send.advertiserId },
    include: { advertiserProfile: true },
  });

  const sesConfig = await getResolvedSesConfig();
  const appUrl = sesConfig.appUrl;
  const token = signTrackingToken(send.id);
  const unsubscribePageUrl = `${appUrl}/unsubscribe/${send.contact.unsubscribeToken}`;
  const listUnsubscribeUrl = `${appUrl}/api/v1/email/unsubscribe/${send.contact.unsubscribeToken}`;

  const candidateFromEmail =
    send.step?.fromEmail?.trim().toLowerCase() ||
    send.broadcast?.fromEmail?.trim().toLowerCase() ||
    settings?.fromEmail?.trim().toLowerCase() ||
    "";

  const verifiedMailbox = await resolveVerifiedMailbox(
    send.advertiserId,
    candidateFromEmail,
  );

  if (!verifiedMailbox) {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: {
        status: "FAILED",
        error: candidateFromEmail
          ? "From email must match a verified sending domain address."
          : "No sending email configured. Set a default on Email Settings or on this broadcast.",
        attemptCount: send.attemptCount + 1,
      },
    });
    await maybeRefreshBroadcast(send.broadcastId);
    return;
  }

  const fromEmail = verifiedMailbox.email;

  const mergeData: Record<string, string> = {
    first_name: send.contact.firstName ?? "",
    last_name: send.contact.lastName ?? "",
    email: send.contact.email,
    phone: send.contact.phone ?? "",
    campaign_name: send.lead?.campaign?.name ?? "",
    company_name:
      send.step?.fromName?.trim() ||
      send.broadcast?.fromName?.trim() ||
      settings?.fromName ||
      send.automation?.fromName ||
      advertiser?.advertiserProfile?.company ||
      advertiser?.name ||
      "Our Team",
    unsubscribe_url: unsubscribePageUrl,
  };

  const subject = renderTemplate(send.template.subject, mergeData);
  let html = renderTemplate(send.template.htmlBody, mergeData);
  const text = send.template.textBody
    ? renderTemplate(send.template.textBody, mergeData)
    : undefined;

  html = wrapLinksForTracking(html, send.id, appUrl, token);
  const pixelUrl = `${appUrl}/api/v1/email/track/open/${send.id}/${token}`;
  html = injectTrackingPixel(html, pixelUrl);
  html = appendUnsubscribeFooter(html, unsubscribePageUrl);

  const fromName =
    send.step?.fromName?.trim() ||
    send.broadcast?.fromName?.trim() ||
    send.automation?.fromName ||
    settings?.fromName ||
    verifiedMailbox.fromName ||
    verifiedMailbox.identity.fromName ||
    advertiser?.advertiserProfile?.company ||
    advertiser?.name ||
    "Team";

  const replyTo =
    send.automation?.replyTo ?? settings?.replyTo ?? PLATFORM_EMAILS.support ?? advertiser?.email;

  // Daily send cap
  const platformRow = await prisma.platformSetting.findUnique({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
  });
  const platformConfig = parseEmailMarketingConfig(platformRow?.value);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const sentToday = await prisma.emailSend.count({
    where: {
      advertiserId: send.advertiserId,
      status: { in: ["SENT", "DELIVERED"] },
      sentAt: { gte: dayStart },
    },
  });
  if (sentToday >= platformConfig.maxSendsPerDay) {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: {
        status: "FAILED",
        error: `Daily send limit reached (${platformConfig.maxSendsPerDay})`,
        attemptCount: send.attemptCount + 1,
      },
    });
    await maybeRefreshBroadcast(send.broadcastId);
    return;
  }

  const result = await sendMarketingEmail({
    to: send.contact.email,
    fromName,
    fromEmail,
    replyTo: replyTo ?? undefined,
    subject,
    html,
    text,
    listUnsubscribeUrl,
  });

  const attemptCount = send.attemptCount + 1;

  if (result.ok) {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: {
        status: "SENT",
        sentAt: new Date(),
        sesMessageId: result.messageId,
        attemptCount,
        error: null,
      },
    });

    await maybeRefreshBroadcast(send.broadcastId);
    return;
  }

  const failed = attemptCount >= MAX_SEND_ATTEMPTS;
  await prisma.emailSend.update({
    where: { id: sendId },
    data: {
      status: failed ? "FAILED" : "QUEUED",
      attemptCount,
      error: result.error,
    },
  });

  if (failed) {
    await maybeRefreshBroadcast(send.broadcastId);
  }

  if (!failed) {
    throw new Error(result.error);
  }
}

export async function sendTestEmail(
  advertiserId: string,
  templateId: string,
  toEmail: string,
  opts?: { fromEmail?: string | null; fromName?: string | null },
) {
  const template = await prisma.emailTemplate.findFirst({
    where: { id: templateId, advertiserId },
  });
  if (!template) throw new Error("Template not found");

  const advertiser = await prisma.user.findUnique({
    where: { id: advertiserId },
    include: { advertiserProfile: true, emailMarketingSettings: true },
  });

  const candidateFrom =
    opts?.fromEmail?.trim().toLowerCase() ||
    advertiser?.emailMarketingSettings?.fromEmail?.trim().toLowerCase() ||
    "";

  const mailbox = await resolveVerifiedMailbox(advertiserId, candidateFrom);

  if (!mailbox) {
    throw new Error(
      "No verified from email. Select a verified domain address or set a default on Email Settings.",
    );
  }

  const sesConfig = await getResolvedSesConfig();
  const fromName =
    opts?.fromName?.trim() ||
    advertiser?.emailMarketingSettings?.fromName ||
    mailbox.fromName ||
    mailbox.identity.fromName ||
    advertiser?.advertiserProfile?.company ||
    advertiser?.name ||
    "Team";

  const mergeData = {
    first_name: "Test",
    last_name: "User",
    email: toEmail,
    phone: "",
    campaign_name: "Test Campaign",
    company_name: fromName,
    unsubscribe_url: `${sesConfig.appUrl}/unsubscribe/test`,
  };

  const subject = `[TEST] ${renderTemplate(template.subject, mergeData)}`;
  let html = renderTemplate(template.htmlBody, mergeData);
  html = appendUnsubscribeFooter(html, mergeData.unsubscribe_url);

  return sendMarketingEmail({
    to: toEmail,
    fromName,
    fromEmail: mailbox.email,
    replyTo: advertiser?.emailMarketingSettings?.replyTo ?? PLATFORM_EMAILS.support,
    subject,
    html,
    text: template.textBody ? renderTemplate(template.textBody, mergeData) : undefined,
    listUnsubscribeUrl: mergeData.unsubscribe_url,
  });
}
