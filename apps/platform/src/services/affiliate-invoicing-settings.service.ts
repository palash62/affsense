import { prisma } from "@/lib/prisma";
import {
  AFFILIATE_INVOICING_SETTINGS_KEY,
  DEFAULT_AFFILIATE_INVOICING_CONFIG,
  mergeAffiliateInvoicingUpdate,
  parseAffiliateInvoicingConfig,
  toAffiliateInvoicingSettingsApi,
  type AffiliateInvoicingConfig,
} from "@/lib/affiliate-invoicing-settings";

export async function loadAffiliateInvoicingConfig(): Promise<AffiliateInvoicingConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: AFFILIATE_INVOICING_SETTINGS_KEY },
  });
  if (!row) return { ...DEFAULT_AFFILIATE_INVOICING_CONFIG };
  return parseAffiliateInvoicingConfig(row.value);
}

export async function getAffiliateInvoicingSettingsForAdmin() {
  const config = await loadAffiliateInvoicingConfig();
  return toAffiliateInvoicingSettingsApi(config);
}

export async function updateAffiliateInvoicingSettings(
  input: {
    enabled?: boolean;
    minimumAmount?: number;
    netTermDays?: number;
    timezone?: string;
    startAt?: string;
  },
  adminId: string,
) {
  const existing = await loadAffiliateInvoicingConfig();
  const next = mergeAffiliateInvoicingUpdate(existing, input);

  await prisma.platformSetting.upsert({
    where: { key: AFFILIATE_INVOICING_SETTINGS_KEY },
    create: { key: AFFILIATE_INVOICING_SETTINGS_KEY, value: next as never },
    update: { value: next as never },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "affiliate_invoicing.settings.updated",
      entityType: "platform_settings",
      entityId: AFFILIATE_INVOICING_SETTINGS_KEY,
      metadata: {
        enabled: next.enabled,
        minimumAmount: next.minimumAmount,
        netTermDays: next.netTermDays,
        timezone: next.timezone,
        startAt: next.startAt,
      },
    },
  });

  return toAffiliateInvoicingSettingsApi(next);
}
