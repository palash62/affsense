import { buttonHtml, emailLayout } from "@/lib/email/templates/layout";

type BaseParams = { appUrl: string; recipientName?: string };

export function renderWelcomeEmail(params: BaseParams & { role: string }) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const roleLabel = params.role.toLowerCase();
  const isAdvertiser = params.role.toUpperCase() === "ADVERTISER";
  const nextStep = isAdvertiser
    ? "Please verify your email to activate your account. We sent you a verification link — click it to get started."
    : "Your account is pending review. We will email you when it is activated.";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Thanks for registering on Affsense as a <strong>${roleLabel}</strong>.</p>
    <p style="margin:0;">${nextStep}</p>
    ${buttonHtml(isAdvertiser ? "Open Affsense" : "Open dashboard", params.appUrl)}`;
  const text = `${greeting}\n\nThanks for registering as a ${roleLabel}. ${nextStep}\n\n${params.appUrl}`;
  return {
    subject: "Welcome to Affsense",
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderAdminAlertEmail(
  params: BaseParams & { title: string; message: string; actionUrl?: string; actionLabel?: string },
) {
  const body = `<p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#6366f1;">Admin alert</p>
    <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#0f172a;">${params.title}</p>
    <p style="margin:0;">${params.message}</p>
    ${params.actionUrl ? buttonHtml(params.actionLabel ?? "Review in admin", params.actionUrl) : ""}`;
  const text = `Admin alert: ${params.title}\n\n${params.message}${params.actionUrl ? `\n\n${params.actionUrl}` : ""}`;
  return {
    subject: `[Affsense Admin] ${params.title}`,
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderApprovedEmail(
  params: BaseParams & {
    itemLabel: string;
    details?: string;
    statusLabel?: string;
    actionUrl?: string;
    actionLabel?: string;
    subject?: string;
  },
) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const statusLabel = params.statusLabel ?? "approved";
  const actionUrl = params.actionUrl ?? params.appUrl;
  const actionLabel = params.actionLabel ?? "View dashboard";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Your <strong>${params.itemLabel}</strong> has been <span style="color:#059669;font-weight:600;">${statusLabel}</span>.</p>
    ${params.details ? `<p style="margin:0 0 12px;">${params.details}</p>` : ""}
    ${buttonHtml(actionLabel, actionUrl)}`;
  const text = `${greeting}\n\nYour ${params.itemLabel} has been ${statusLabel}.${params.details ? `\n${params.details}` : ""}\n\n${actionUrl}`;
  return {
    subject: params.subject ?? `${params.itemLabel} ${statusLabel}`,
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderRejectedEmail(
  params: BaseParams & {
    itemLabel: string;
    reason: string;
    details?: string;
    actionUrl?: string;
    actionLabel?: string;
    subject?: string;
  },
) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const actionUrl = params.actionUrl ?? params.appUrl;
  const actionLabel = params.actionLabel ?? "Open dashboard";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Your <strong>${params.itemLabel}</strong> was <span style="color:#dc2626;font-weight:600;">not approved</span>.</p>
    <div style="margin:16px 0;padding:12px 14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
      <p style="margin:0;font-size:13px;color:#991b1b;"><strong>Note:</strong> ${params.reason}</p>
    </div>
    ${params.details ? `<p style="margin:0 0 12px;">${params.details}</p>` : ""}
    ${buttonHtml(actionLabel, actionUrl)}`;
  const text = `${greeting}\n\nYour ${params.itemLabel} was not approved.\nReason: ${params.reason}${params.details ? `\n${params.details}` : ""}\n\n${actionUrl}`;
  return {
    subject: params.subject ?? `${params.itemLabel} not approved`,
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderGenericEmail(params: BaseParams & { title: string; message: string; actionUrl?: string; actionLabel?: string }) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#0f172a;">${params.title}</p>
    <div style="margin:0;">${params.message}</div>
    ${params.actionUrl ? buttonHtml(params.actionLabel ?? "View details", params.actionUrl) : ""}`;
  const text = `${greeting}\n\n${params.title}\n${params.message.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}${params.actionUrl ? `\n\n${params.actionUrl}` : ""}`;
  return {
    subject: params.title,
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderCredentialsEmail(
  params: BaseParams & { email: string; tempPassword: string },
) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">An admin created your publisher account on Affsense.</p>
    <div style="margin:16px 0;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-family:monospace;font-size:14px;">
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${params.email}</p>
      <p style="margin:0;"><strong>Temporary password:</strong> ${params.tempPassword}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">Please sign in and change your password immediately.</p>
    ${buttonHtml("Sign in", `${params.appUrl}/login`)}`;
  const text = `${greeting}\n\nYour publisher account was created.\nEmail: ${params.email}\nTemporary password: ${params.tempPassword}\n\nSign in: ${params.appUrl}/login`;
  return {
    subject: "Your Affsense publisher account",
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderPasswordResetEmail(params: BaseParams & { resetUrl: string }) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">We received a request to reset your password. This link expires in 1 hour.</p>
    ${buttonHtml("Reset password", params.resetUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">If you did not request this, you can ignore this email.</p>`;
  const text = `${greeting}\n\nReset your password: ${params.resetUrl}\n\nThis link expires in 1 hour.`;
  return {
    subject: "Reset your Affsense password",
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderEmailVerificationEmail(params: BaseParams & { verifyUrl: string }) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Please verify your email address to complete registration.</p>
    ${buttonHtml("Verify email", params.verifyUrl)}
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">This link expires in 24 hours.</p>`;
  const text = `${greeting}\n\nVerify your email: ${params.verifyUrl}`;
  return {
    subject: "Verify your email — Affsense",
    html: emailLayout(body, params.appUrl),
    text,
  };
}

export function renderLoginOtpEmail(
  params: BaseParams & { code: string; expiresMinutes: number },
) {
  const greeting = params.recipientName ? `Hi ${params.recipientName},` : "Hi,";
  const body = `<p style="margin:0 0 12px;">${greeting}</p>
    <p style="margin:0 0 12px;">Use this code to sign in to your Affsense account:</p>
    <div style="margin:16px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;text-align:center;">
      <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#0f172a;font-family:monospace;">${params.code}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">This code expires in ${params.expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`;
  const text = `${greeting}\n\nYour Affsense sign-in code: ${params.code}\n\nThis code expires in ${params.expiresMinutes} minutes.`;
  return {
    subject: "Your Affsense sign-in code",
    html: emailLayout(body, params.appUrl),
    text,
  };
}
