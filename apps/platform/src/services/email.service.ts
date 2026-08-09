import type { Prisma } from "@prisma/client";
import type { SendEmailInput } from "@/lib/email/types";
import { getMailgunConfig, isMailgunConfigured, sendViaMailgun } from "@/lib/email/mailgun";
import { getTransporterForConfig, resetEmailTransport } from "@/lib/email/transport";
import { prisma } from "@/lib/prisma";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";

export { resetEmailTransport };
export { isMailgunConfigured, getMailgunConfig };

export type EmailProviderStatus = {
  provider: "mailgun" | "smtp" | "none";
  source: "database" | "environment" | "none";
  configured: boolean;
};

export async function getEmailProviderStatus(): Promise<EmailProviderStatus> {
  if (isMailgunConfigured()) {
    return { provider: "mailgun", source: "environment", configured: true };
  }

  const smtpConfig = await getResolvedEmailConfig();
  const transport = getTransporterForConfig(smtpConfig);
  if (transport) {
    return { provider: "smtp", source: smtpConfig.source, configured: true };
  }

  return { provider: "none", source: "none", configured: false };
}

async function logEmail(
  input: SendEmailInput,
  status: "sent" | "failed" | "skipped",
  error?: string,
) {
  try {
    await prisma.emailLog.create({
      data: {
        to: input.to,
        template: input.template ?? "generic",
        subject: input.subject,
        status,
        error: error ?? null,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // Logging must not break the app
  }
}

async function sendViaSmtp(
  input: SendEmailInput,
  smtpConfig: Awaited<ReturnType<typeof getResolvedEmailConfig>>,
): Promise<{ sent: boolean; skipped?: boolean; error?: string; provider?: "smtp" }> {
  const transport = getTransporterForConfig(smtpConfig);
  if (!transport) {
    console.info("[email:skipped]", {
      to: input.to,
      subject: input.subject,
      template: input.template,
      preview: input.text.slice(0, 200),
    });
    await logEmail(input, "skipped");
    return { sent: false, skipped: true };
  }

  try {
    await transport.sendMail({
      from: input.from ?? smtpConfig.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.listUnsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${input.listUnsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });
    await logEmail(input, "sent");
    return { sent: true, provider: "smtp" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email error";
    console.error("[email:failed]", input.to, input.subject, message);
    await logEmail(input, "failed", message);
    return { sent: false, error: message, provider: "smtp" };
  }
}

export async function sendEmail(
  input: SendEmailInput,
): Promise<{
  sent: boolean;
  skipped?: boolean;
  error?: string;
  provider?: "mailgun" | "smtp";
  messageId?: string;
}> {
  const smtpConfig = await getResolvedEmailConfig();

  if (isMailgunConfigured()) {
    const mailgun = getMailgunConfig()!;
    const result = await sendViaMailgun({
      to: input.to,
      from: input.from ?? mailgun.from,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      listUnsubscribeUrl: input.listUnsubscribeUrl,
    });

    if (result.ok) {
      await logEmail(input, "sent");
      return { sent: true, provider: "mailgun", messageId: result.id };
    }

    console.error("[email:mailgun-failed]", input.to, input.subject, result.error);
    const smtpFallback = getTransporterForConfig(smtpConfig);
    if (smtpFallback) {
      console.info("[email:mailgun-fallback-smtp]", input.to, input.subject);
      return sendViaSmtp(input, smtpConfig);
    }

    await logEmail(input, "failed", result.error);
    return { sent: false, error: result.error, provider: "mailgun" };
  }

  return sendViaSmtp(input, smtpConfig);
}

export async function getAdminAlertEmail() {
  const config = await getResolvedEmailConfig();
  if (config.adminAlertEmail) return config.adminAlertEmail;

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  return admin?.email ?? null;
}

export async function getSupportEmail() {
  const config = await getResolvedEmailConfig();
  return config.supportEmail || null;
}

export async function getSupportFromEmail(): Promise<string | null> {
  const explicit = process.env.SUPPORT_FROM_EMAIL?.trim();
  if (explicit) return explicit;

  const mailgun = getMailgunConfig();
  if (mailgun?.domain) return `support@${mailgun.domain}`;

  return getSupportEmail();
}

export async function testSmtpConnection(testTo?: string) {
  resetEmailTransport();
  const config = await getResolvedEmailConfig();
  const mailgunReady = isMailgunConfigured();
  const transport = getTransporterForConfig(config);

  if (!mailgunReady && !transport) {
    return {
      ok: false,
      message:
        "Email is not configured. Set MAILGUN_API_KEY + MAILGUN_DOMAIN, or SMTP settings / SMTP_HOST.",
    };
  }

  const to = testTo || config.adminAlertEmail;
  if (!to) {
    return { ok: false, message: "No recipient. Set admin alert email or pass a test address." };
  }

  const result = await sendEmail({
    to,
    subject: mailgunReady ? "LeadVix Mailgun test" : "LeadVix SMTP test",
    html: `<p>Email test successful at ${new Date().toISOString()}</p>`,
    text: `Email test successful at ${new Date().toISOString()}`,
    template: "generic",
    metadata: { kind: mailgunReady ? "mailgun_test" : "smtp_test" },
  });

  return result.sent
    ? { ok: true, message: `Test email sent to ${to} via ${result.provider ?? "email"}` }
    : {
        ok: false,
        message: result.error ?? "Failed to send test email. Check server logs.",
      };
}

export async function listEmailLogs(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    prisma.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.emailLog.count(),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
