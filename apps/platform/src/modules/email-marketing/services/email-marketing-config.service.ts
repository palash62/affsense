import { prisma } from "@/lib/prisma";
import {
  DEFAULT_EMAIL_MARKETING_CONFIG,
  EMAIL_MARKETING_CONFIG_KEY,
  type EmailMarketingPlatformConfig,
} from "@/lib/email/email-marketing-settings";
import { parseEmailMarketingConfig } from "@/modules/email-marketing/config/platform-config";

export async function getEmailMarketingPlatformConfig(): Promise<EmailMarketingPlatformConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
  });
  return parseEmailMarketingConfig(row?.value);
}

export async function updateEmailMarketingPlatformConfig(
  input: Partial<EmailMarketingPlatformConfig>,
  adminId: string,
): Promise<EmailMarketingPlatformConfig> {
  const current = await getEmailMarketingPlatformConfig();
  const next: EmailMarketingPlatformConfig = {
    enabled: input.enabled ?? current.enabled,
    maxAutomationsPerAdvertiser:
      input.maxAutomationsPerAdvertiser ?? current.maxAutomationsPerAdvertiser,
    maxSendsPerDay: input.maxSendsPerDay ?? current.maxSendsPerDay,
    emailsPerDollar: input.emailsPerDollar ?? current.emailsPerDollar,
  };

  if (!Number.isFinite(next.emailsPerDollar) || next.emailsPerDollar <= 0) {
    next.emailsPerDollar = DEFAULT_EMAIL_MARKETING_CONFIG.emailsPerDollar;
  }

  await prisma.platformSetting.upsert({
    where: { key: EMAIL_MARKETING_CONFIG_KEY },
    create: { key: EMAIL_MARKETING_CONFIG_KEY, value: next as never },
    update: { value: next as never },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "settings.updated",
      entityType: "email_marketing_config",
      entityId: "global",
      metadata: next as never,
    },
  });

  return next;
}
