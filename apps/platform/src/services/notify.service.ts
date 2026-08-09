import {
  renderAdminAlertEmail,
  renderApprovedEmail,
  renderCredentialsEmail,
  renderEmailVerificationEmail,
  renderGenericEmail,
  renderLoginOtpEmail,
  renderPasswordResetEmail,
  renderRejectedEmail,
  renderWelcomeEmail,
} from "@/lib/email/templates";
import type { EmailTemplateId } from "@/lib/email/types";
import { prisma } from "@/lib/prisma";
import { sendEmail, getAdminAlertEmail } from "@/services/email.service";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";
import { createNotification } from "@/services/notification.service";

async function baseParams(recipientName?: string) {
  const config = await getResolvedEmailConfig();
  return { appUrl: config.appUrl, recipientName };
}

async function deliver(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: EmailTemplateId;
  metadata?: Record<string, unknown>;
  replyTo?: string;
  userId?: string;
  notificationType?: string;
  notificationTitle?: string;
  notificationBody?: string;
}) {
  const result = await sendEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    template: params.template,
    metadata: params.metadata,
    replyTo: params.replyTo,
  });

  if (params.userId && params.notificationType && params.notificationTitle && params.notificationBody) {
    try {
      await createNotification(
        params.userId,
        params.notificationType,
        params.notificationTitle,
        params.notificationBody,
      );
    } catch {
      // In-app notification must not break email delivery
    }
  }

  return result;
}

export async function notifyWelcome(user: { id: string; email: string; name: string; role: string }) {
  const isAdvertiser = user.role.toUpperCase() === "ADVERTISER";
  const rendered = renderWelcomeEmail({ ...(await baseParams(user.name)), role: user.role });
  return deliver({
    to: user.email,
    ...rendered,
    template: "welcome",
    userId: user.id,
    notificationType: "auth.welcome",
    notificationTitle: "Welcome to LeadVix",
    notificationBody: isAdvertiser
      ? "Check your email and verify your address to activate your account."
      : "Your account is pending review. We will notify you when it is activated.",
  });
}

export async function notifyAccountActivated(user: { id: string; email: string; name: string }) {
  const rendered = renderApprovedEmail({
    ...(await baseParams(user.name)),
    itemLabel: "Account",
    statusLabel: "activated",
    details: "Your email is verified and your account is now active. You can sign in and use the platform.",
  });
  return deliver({
    to: user.email,
    ...rendered,
    template: "approved",
    userId: user.id,
    notificationType: "account.activated",
    notificationTitle: "Account activated",
    notificationBody: "Your email is verified and your account is now active.",
  });
}

export async function notifyAccountSuspended(
  user: { id: string; email: string; name: string },
  reason?: string,
) {
  const rendered = renderRejectedEmail({
    ...(await baseParams(user.name)),
    itemLabel: "Account",
    reason: reason?.trim() || "Please contact support for more information.",
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "rejected",
    userId: user.id,
    notificationType: "account.suspended",
    notificationTitle: "Account suspended",
    notificationBody: reason?.trim() || "Your account has been suspended.",
  });
}

export async function notifyPublisherCredentials(user: {
  id: string;
  email: string;
  name: string;
  tempPassword: string;
}) {
  await notifyAccountCredentials({ ...user, roleLabel: "Publisher" });
}

export async function notifyAdvertiserCredentials(user: {
  id: string;
  email: string;
  name: string;
  tempPassword: string;
}) {
  await notifyAccountCredentials({ ...user, roleLabel: "Advertiser" });
}

export async function notifyPlatformManagerCredentials(user: {
  id: string;
  email: string;
  name: string;
  tempPassword: string;
}) {
  await notifyAccountCredentials({ ...user, roleLabel: "Platform Manager" });
}

async function notifyAccountCredentials(user: {
  id: string;
  email: string;
  name: string;
  tempPassword: string;
  roleLabel: string;
}) {
  const rendered = renderCredentialsEmail({
    ...(await baseParams(user.name)),
    email: user.email,
    tempPassword: user.tempPassword,
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "credentials",
    userId: user.id,
    notificationType: "auth.credentials",
    notificationTitle: `${user.roleLabel} account created`,
    notificationBody: "Check your email for your temporary password.",
  });
}

export async function notifyPasswordChanged(user: { id: string; email: string; name: string }) {
  const rendered = renderGenericEmail({
    ...(await baseParams(user.name)),
    title: "Password changed",
    message: "Your LeadVix password was changed successfully. If this was not you, contact support immediately.",
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "password_changed",
    userId: user.id,
    notificationType: "auth.password_changed",
    notificationTitle: "Password changed",
    notificationBody: "Your password was updated successfully.",
  });
}

export async function notifyPasswordReset(user: { id: string; email: string; name: string }, token: string) {
  const config = await getResolvedEmailConfig();
  const resetUrl = `${config.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const rendered = renderPasswordResetEmail({ ...(await baseParams(user.name)), resetUrl });
  await deliver({
    to: user.email,
    ...rendered,
    template: "password_reset",
    metadata: { userId: user.id },
  });
}

export async function notifyEmailVerification(user: { id: string; email: string; name: string }, token: string) {
  const config = await getResolvedEmailConfig();
  const verifyUrl = `${config.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const rendered = renderEmailVerificationEmail({ ...(await baseParams(user.name)), verifyUrl });
  return deliver({
    to: user.email,
    ...rendered,
    template: "email_verification",
    metadata: { userId: user.id },
  });
}

export async function notifyLoginOtp(
  user: { id: string; email: string; name: string },
  code: string,
  expiresMinutes: number,
) {
  const rendered = renderLoginOtpEmail({
    ...(await baseParams(user.name)),
    code,
    expiresMinutes,
  });
  return deliver({
    to: user.email,
    ...rendered,
    template: "generic",
    userId: user.id,
    notificationType: "auth.login_otp",
    notificationTitle: "Sign-in code sent",
    notificationBody: "Check your email for your 6-digit sign-in code.",
  });
}

export async function notifyAdminAlert(params: {
  title: string;
  message: string;
  actionPath?: string;
  actionLabel?: string;
  metadata?: Record<string, unknown>;
}) {
  const adminEmail = await getAdminAlertEmail();
  if (!adminEmail) return;

  const config = await getResolvedEmailConfig();
  const rendered = renderAdminAlertEmail({
    appUrl: config.appUrl,
    title: params.title,
    message: params.message,
    actionUrl: params.actionPath ? `${config.appUrl}${params.actionPath}` : undefined,
    actionLabel: params.actionLabel,
  });

  await sendEmail({
    to: adminEmail,
    ...rendered,
    template: "admin_alert",
    metadata: params.metadata,
  });
}

export async function notifyApproved(
  user: { id: string; email: string; name: string },
  itemLabel: string,
  details?: string,
  notificationType?: string,
) {
  const rendered = renderApprovedEmail({ ...(await baseParams(user.name)), itemLabel, details });
  await deliver({
    to: user.email,
    ...rendered,
    template: "approved",
    userId: user.id,
    notificationType: notificationType ?? "item.approved",
    notificationTitle: `${itemLabel} approved`,
    notificationBody: details ?? `Your ${itemLabel.toLowerCase()} has been approved.`,
  });
}

export async function notifyRejected(
  user: { id: string; email: string; name: string },
  itemLabel: string,
  reason: string,
  details?: string,
  notificationType?: string,
) {
  const rendered = renderRejectedEmail({ ...(await baseParams(user.name)), itemLabel, reason, details });
  await deliver({
    to: user.email,
    ...rendered,
    template: "rejected",
    userId: user.id,
    notificationType: notificationType ?? "item.rejected",
    notificationTitle: `${itemLabel} not approved`,
    notificationBody: reason,
  });
}

export async function notifyCampaignApproved(
  user: { id: string; email: string; name: string },
  params: { campaignId: string; campaignName: string },
) {
  const config = await getResolvedEmailConfig();
  const actionUrl = `${config.appUrl}/advertiser/campaigns/${params.campaignId}`;
  const itemLabel = `campaign "${params.campaignName}"`;
  const details = "Your campaign is now active and can receive traffic.";
  const rendered = renderApprovedEmail({
    ...(await baseParams(user.name)),
    itemLabel,
    statusLabel: "approved",
    details,
    actionUrl,
    actionLabel: "View campaign",
    subject: `Campaign approved — ${params.campaignName} is now active`,
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "approved",
    userId: user.id,
    notificationType: "campaign.approved",
    notificationTitle: `Campaign "${params.campaignName}" approved`,
    notificationBody: details,
  });
}

export async function notifyCampaignRejected(
  user: { id: string; email: string; name: string },
  params: { campaignId: string; campaignName: string; reason: string },
) {
  const config = await getResolvedEmailConfig();
  const actionUrl = `${config.appUrl}/advertiser/campaigns/${params.campaignId}`;
  const itemLabel = `campaign "${params.campaignName}"`;
  const rendered = renderRejectedEmail({
    ...(await baseParams(user.name)),
    itemLabel,
    reason: params.reason,
    details: "You can update the campaign and resubmit it for review.",
    actionUrl,
    actionLabel: "View campaign",
    subject: `Campaign not approved — ${params.campaignName}`,
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "rejected",
    userId: user.id,
    notificationType: "campaign.rejected",
    notificationTitle: `Campaign "${params.campaignName}" not approved`,
    notificationBody: params.reason,
  });
}

export async function notifyGeneric(
  user: { id: string; email: string; name: string },
  params: {
    title: string;
    message: string;
    actionPath?: string;
    actionLabel?: string;
    notificationType: string;
    replyTo?: string;
  },
) {
  const config = await getResolvedEmailConfig();
  const rendered = renderGenericEmail({
    ...(await baseParams(user.name)),
    title: params.title,
    message: params.message,
    actionUrl: params.actionPath ? `${config.appUrl}${params.actionPath}` : undefined,
    actionLabel: params.actionLabel,
  });
  await deliver({
    to: user.email,
    ...rendered,
    template: "generic",
    replyTo: params.replyTo,
    userId: user.id,
    notificationType: params.notificationType,
    notificationTitle: params.title,
    notificationBody: params.message,
  });
}

export async function notifyReferralSignup(
  referrer: { id: string; email: string; name: string },
  referral: { name: string; email: string },
) {
  await notifyGeneric(referrer, {
    title: "New referral signup",
    message: `${referral.name} (${referral.email}) joined using your referral link.`,
    actionPath: "/advertiser/referal_link",
    actionLabel: "View referrals",
    notificationType: "referral.signup",
  });
}

export async function notifyReferralCommission(
  referrerId: string,
  params: { amount: number; level: 1 | 2 },
) {
  const user = await loadUser(referrerId);
  if (!user) return;

  await notifyGeneric(user, {
    title: "Referral commission earned",
    message: `You earned $${params.amount.toFixed(2)} from a Level ${params.level} referral.`,
    actionPath: "/advertiser/referal_link",
    actionLabel: "View earnings",
    notificationType: "referral.commission",
  });
}

export async function notifyLowBalanceTiers(
  userId: string,
  tiers: Array<50 | 10 | 0>,
  balance: number,
) {
  if (!tiers.length) return;
  const user = await loadUser(userId);
  if (!user || user.role !== "ADVERTISER") return;

  const { lowBalanceAlertCopy, lowBalanceNotificationType } = await import(
    "@/lib/low-balance-alerts"
  );

  for (const tier of tiers) {
    const copy = lowBalanceAlertCopy(tier, balance);
    await notifyGeneric(user, {
      title: copy.title,
      message: copy.message,
      actionPath: "/advertiser/wallet",
      actionLabel: "Add funds",
      notificationType: lowBalanceNotificationType(tier),
    });
  }
}

export async function notifyCampaignBudgetReached(
  advertiserId: string,
  params: {
    campaignId: string;
    campaignName: string;
    budget: number;
    spent: number;
    cpl: number;
  },
) {
  const user = await loadUser(advertiserId);
  if (!user) return;

  const message =
    `Campaign "${params.campaignName}" has reached its total budget but will keep running while your wallet has funds. ` +
    `Budget: $${params.budget.toFixed(2)} · Spent: $${params.spent.toFixed(2)} · ` +
    `CPL: $${params.cpl.toFixed(2)}. ` +
    `The campaign pauses automatically only when your wallet balance is too low to pay for the next lead.`;

  await notifyGeneric(user, {
    title: `Campaign budget reached — still running`,
    message,
    actionPath: `/advertiser/campaigns/${params.campaignId}`,
    actionLabel: "View campaign",
    notificationType: "campaign.budget_reached",
  });
}

export async function notifyCampaignPausedForFunds(
  advertiserId: string,
  params: {
    campaignId: string;
    campaignName: string;
  },
) {
  const user = await loadUser(advertiserId);
  if (!user) return;

  await notifyGeneric(user, {
    title: "Campaign paused — wallet empty",
    message:
      `Campaign "${params.campaignName}" was paused because your wallet balance is too low to pay for leads. ` +
      `Deposit funds and the campaign will resume automatically.`,
    actionPath: "/advertiser/wallet",
    actionLabel: "Add funds",
    notificationType: "campaign.paused_insufficient_funds",
  });
}

async function loadUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });
}

export async function notifyUserById(
  userId: string,
  params: {
    title: string;
    message: string;
    actionPath?: string;
    actionLabel?: string;
    notificationType: string;
    replyTo?: string;
  },
) {
  const user = await loadUser(userId);
  if (!user) return;
  await notifyGeneric(user, params);
}
