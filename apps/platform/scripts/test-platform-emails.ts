/**
 * Test Affsense transactional email templates (Mailgun preferred, SMTP fallback).
 * Run: npm run test:emails --workspace @cpl/platform
 *
 * Optional: TEST_EMAIL_TO=someone@example.com npm run test:emails --workspace @cpl/platform
 */
import { config } from "dotenv";
import { resolve } from "node:path";
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
import { lowBalanceAlertCopy } from "@/lib/low-balance-alerts";
import type { EmailTemplateId } from "@/lib/email/types";
import { PLATFORM_EMAILS } from "@/lib/email/addresses";
import { getMailgunConfig, isMailgunConfigured } from "@/lib/email/mailgun";
import {
  sendEmail,
  getAdminAlertEmail,
  getSupportEmail,
  resetEmailTransport,
} from "@/services/email.service";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";

config({ path: resolve(import.meta.dirname, "../.env") });

const TEST_TO = (process.env.TEST_EMAIL_TO?.trim() || "ppalash62@gmail.com").toLowerCase();
const TEST_USER = {
  id: "email-test-user",
  email: TEST_TO,
  name: "Palash",
  role: "ADVERTISER",
};
const DUMMY_TOKEN = "test-token-do-not-use";

type Result = { name: string; template: EmailTemplateId; ok: boolean; detail: string };

async function sendTemplate(
  name: string,
  template: EmailTemplateId,
  rendered: { subject: string; html: string; text: string },
  metadata?: Record<string, unknown>,
): Promise<Result> {
  const result = await sendEmail({
    to: TEST_TO,
    ...rendered,
    template,
    metadata: { kind: "platform_email_test", ...metadata },
  });
  const detail = result.skipped
    ? "skipped (no Mailgun or SMTP configured)"
    : result.sent
      ? `sent via ${result.provider ?? "email"}`
      : result.error ?? "failed";
  return { name, template, ok: result.sent === true, detail };
}

async function main() {
  resetEmailTransport();

  const mailgun = getMailgunConfig();
  const emailConfig = await getResolvedEmailConfig();
  const adminEmail = (await getAdminAlertEmail()) ?? PLATFORM_EMAILS.admin;
  const supportEmail = (await getSupportEmail()) ?? PLATFORM_EMAILS.support;
  const stamp = new Date().toISOString();
  const appUrl = emailConfig.appUrl;
  const base = { appUrl, recipientName: TEST_USER.name };

  const provider = isMailgunConfigured()
    ? "mailgun"
    : emailConfig.enabled && emailConfig.host
      ? "smtp"
      : "none";

  console.log("Provider:", provider);
  if (mailgun) {
    console.log("Mailgun domain:", mailgun.domain);
    console.log("Mailgun API base:", mailgun.apiBase);
    console.log("From:", mailgun.from);
  } else {
    console.log("SMTP source:", emailConfig.source);
    console.log("SMTP enabled:", emailConfig.enabled);
    console.log("SMTP host:", emailConfig.host ?? "(none)");
    console.log("From:", emailConfig.from);
  }
  console.log("Test recipient:", TEST_TO);
  console.log("Admin alert email:", adminEmail);
  console.log("Support reply-to:", supportEmail);
  console.log("");

  if (provider === "none") {
    console.error(
      "No email provider configured. Set MAILGUN_API_KEY + MAILGUN_DOMAIN in apps/platform/.env (preferred), or SMTP_HOST.",
    );
    process.exit(1);
  }

  if (provider === "smtp" && emailConfig.source === "database") {
    console.warn(
      "WARNING: Using DB smtp_config (overrides env SMTP). Clear Admin → Settings → SMTP if credentials look wrong.\n",
    );
  }

  const results: Result[] = [];

  results.push(
    await sendTemplate(
      "welcome (signup)",
      "welcome",
      renderWelcomeEmail({ ...base, role: TEST_USER.role }),
    ),
  );

  results.push(
    await sendTemplate(
      "email_verification",
      "email_verification",
      renderEmailVerificationEmail({
        ...base,
        verifyUrl: `${appUrl}/verify-email?token=${encodeURIComponent(DUMMY_TOKEN)}`,
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "approved (account activated)",
      "approved",
      renderApprovedEmail({
        ...base,
        itemLabel: "Account",
        details: "You can now sign in and use the platform.",
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "password_reset",
      "password_reset",
      renderPasswordResetEmail({
        ...base,
        resetUrl: `${appUrl}/reset-password?token=${encodeURIComponent(DUMMY_TOKEN)}`,
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "password_changed",
      "password_changed",
      renderGenericEmail({
        ...base,
        title: "Password changed",
        message:
          "Your Affsense password was changed successfully. If this was not you, contact support immediately.",
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "admin_alert",
      "admin_alert",
      renderAdminAlertEmail({
        appUrl,
        title: "Email test — admin alerts",
        message: `Admin alert test at ${stamp}. Sent to ${TEST_TO} for verification.`,
        actionUrl: `${appUrl}/admin/settings`,
        actionLabel: "Open settings",
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "login code (OTP)",
      "generic",
      renderLoginOtpEmail({ ...base, code: "482913", expiresMinutes: 10 }),
    ),
  );

  results.push(
    await sendTemplate(
      "login details (admin-created account)",
      "credentials",
      renderCredentialsEmail({ ...base, email: TEST_TO, tempPassword: "Temp-Pass-1234" }),
    ),
  );

  results.push(
    await sendTemplate(
      "rejected (publisher application)",
      "rejected",
      renderRejectedEmail({
        ...base,
        itemLabel: "Publisher account",
        reason: "Test rejection reason — traffic source could not be verified.",
      }),
    ),
  );

  const campaignName = "Email Test Campaign";
  const campaignUrl = `${appUrl}/advertiser/campaigns/test-campaign`;
  results.push(
    await sendTemplate(
      "campaign approved",
      "approved",
      renderApprovedEmail({
        ...base,
        itemLabel: `campaign "${campaignName}"`,
        statusLabel: "approved",
        details: "Your campaign is now active and can receive traffic.",
        actionUrl: campaignUrl,
        actionLabel: "View campaign",
        subject: `Campaign approved — ${campaignName} is now active`,
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "campaign rejected",
      "rejected",
      renderRejectedEmail({
        ...base,
        itemLabel: `campaign "${campaignName}"`,
        reason: "Test rejection reason — landing page is missing a privacy policy.",
        details: "You can update the campaign and resubmit it for review.",
        actionUrl: campaignUrl,
        actionLabel: "View campaign",
        subject: `Campaign not approved — ${campaignName}`,
      }),
    ),
  );

  const lowBalance = lowBalanceAlertCopy(10, 8.5);
  results.push(
    await sendTemplate(
      "low wallet balance (generic notice)",
      "generic",
      renderGenericEmail({
        ...base,
        title: lowBalance.title,
        message: lowBalance.message,
        actionUrl: `${appUrl}/advertiser/wallet`,
        actionLabel: "Add funds",
      }),
    ),
  );

  results.push(
    await sendTemplate(
      "support reply (generic notice)",
      "generic",
      renderGenericEmail({
        ...base,
        title: "Support reply",
        message: 'Admin replied to your ticket "Email test ticket".',
        actionUrl: `${appUrl}/advertiser/support`,
      }),
    ),
  );

  console.log("Results:");
  for (const r of results) {
    console.log(`  ${r.ok ? "OK" : "FAIL"}  [${r.template}] ${r.name}: ${r.detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`\n${failed.length}/${results.length} email(s) failed or were skipped.`);
    process.exit(1);
  }

  console.log(`\nAll ${results.length} templates sent to ${TEST_TO}. Check inbox/spam.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
