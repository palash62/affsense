import {
  SESv2Client,
  SendEmailCommand,
  type SendEmailCommandInput,
} from "@aws-sdk/client-sesv2";
import { getResolvedSesConfig } from "@/services/ses-settings.service";
import { sendEmail } from "@/services/email.service";
import { getMailgunConfig } from "@/lib/email/mailgun";
import { getResolvedEmailConfig } from "@/services/smtp-settings.service";

let cachedClient: SESv2Client | null = null;
let cachedKey: string | null = null;

function getClient(config: Awaited<ReturnType<typeof getResolvedSesConfig>>) {
  const key = [config.region, config.accessKeyId, config.secretAccessKey].join("|");
  if (cachedClient && cachedKey === key) return cachedClient;

  cachedClient = new SESv2Client({
    region: config.region,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
  });
  cachedKey = key;
  return cachedClient;
}

export type MarketingEmailInput = {
  to: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  listUnsubscribeUrl: string;
};

export type MarketingEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

async function sendViaSes(
  input: MarketingEmailInput,
  config: Awaited<ReturnType<typeof getResolvedSesConfig>>,
): Promise<MarketingEmailResult> {
  const from = `"${input.fromName.replace(/"/g, '\\"')}" <${input.fromEmail}>`;

  const commandInput: SendEmailCommandInput = {
    FromEmailAddress: from,
    Destination: { ToAddresses: [input.to] },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: input.html, Charset: "UTF-8" },
          ...(input.text ? { Text: { Data: input.text, Charset: "UTF-8" } } : {}),
        },
        Headers: [
          {
            Name: "List-Unsubscribe",
            Value: `<${input.listUnsubscribeUrl}>`,
          },
          {
            Name: "List-Unsubscribe-Post",
            Value: "List-Unsubscribe=One-Click",
          },
        ],
      },
    },
    ...(input.replyTo ? { ReplyToAddresses: [input.replyTo] } : {}),
    ...(config.configurationSet
      ? { ConfigurationSetName: config.configurationSet }
      : {}),
  };

  try {
    const client = getClient(config);
    const result = await client.send(new SendEmailCommand(commandInput));
    return { ok: true, messageId: result.MessageId ?? "unknown" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SES send failed";
    console.error("[email-marketing] SES error:", message);
    return { ok: false, error: message };
  }
}

async function sendViaTransactionalProvider(
  input: MarketingEmailInput,
): Promise<MarketingEmailResult> {
  const from = `"${input.fromName.replace(/"/g, '\\"')}" <${input.fromEmail}>`;
  const result = await sendEmail({
    to: input.to,
    from,
    subject: input.subject,
    html: input.html,
    text: input.text ?? "",
    replyTo: input.replyTo,
    listUnsubscribeUrl: input.listUnsubscribeUrl,
    template: "generic",
  });

  if (result.sent) {
    return { ok: true, messageId: `${result.provider ?? "smtp"}-${Date.now()}` };
  }
  return { ok: false, error: result.error ?? "Email provider send failed" };
}

export async function sendMarketingEmail(
  input: MarketingEmailInput,
): Promise<MarketingEmailResult> {
  const sesConfig = await getResolvedSesConfig();

  if (sesConfig.enabled) {
    return sendViaSes(input, sesConfig);
  }

  console.info("[email-marketing] SES not configured — falling back to Mailgun/SMTP for", input.to);
  return sendViaTransactionalProvider(input);
}

export function buildFromAddress(fromName: string, fromEmail: string): { fromName: string; fromEmail: string } {
  return { fromName, fromEmail };
}

export async function getDefaultFromEmail(): Promise<string> {
  const sesConfig = await getResolvedSesConfig();
  if (sesConfig.enabled) return sesConfig.fromEmail;

  const mailgun = getMailgunConfig();
  if (mailgun) {
    const match = mailgun.from.match(/<([^>]+)>/);
    return match?.[1] ?? mailgun.from;
  }

  const smtpConfig = await getResolvedEmailConfig();
  if (smtpConfig.from) {
    const match = smtpConfig.from.match(/<([^>]+)>/);
    return match?.[1] ?? smtpConfig.from;
  }

  return sesConfig.fromEmail;
}

export async function getMarketingProviderName(): Promise<string> {
  const sesConfig = await getResolvedSesConfig();
  if (sesConfig.enabled) return "ses";

  const mailgun = getMailgunConfig();
  if (mailgun) return "mailgun";

  return "smtp";
}
