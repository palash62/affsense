import { prisma } from "@/lib/prisma";
import type { Prisma, WebhookEventStatus } from "@prisma/client";
import {
  CLICKFUNNELS_WEBHOOK_SETTINGS_KEY,
  DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG,
  mergeClickFunnelsWebhookUpdate,
  parseClickFunnelsWebhookConfig,
  toClickFunnelsWebhookSettingsApi,
  type ClickFunnelsWebhookConfig,
} from "@/lib/clickfunnels-webhook-settings";

export async function loadClickFunnelsWebhookConfig(): Promise<ClickFunnelsWebhookConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: CLICKFUNNELS_WEBHOOK_SETTINGS_KEY },
  });
  if (!row) return { ...DEFAULT_CLICKFUNNELS_WEBHOOK_CONFIG };
  return parseClickFunnelsWebhookConfig(row.value);
}

export async function getClickFunnelsWebhookSettingsForAdmin() {
  const config = await loadClickFunnelsWebhookConfig();
  return toClickFunnelsWebhookSettingsApi(config);
}

export async function updateClickFunnelsWebhookSettings(
  input: {
    enabled?: boolean;
    name?: string;
    affiliateTrackingParam?: string;
    webhookSecret?: string;
    regenerateSecret?: boolean;
    secretHeaderName?: string;
    notes?: string;
  },
  adminId: string,
) {
  const existing = await loadClickFunnelsWebhookConfig();
  const next = mergeClickFunnelsWebhookUpdate(existing, input);

  await prisma.platformSetting.upsert({
    where: { key: CLICKFUNNELS_WEBHOOK_SETTINGS_KEY },
    create: { key: CLICKFUNNELS_WEBHOOK_SETTINGS_KEY, value: next as never },
    update: { value: next as never },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "clickfunnels.webhook.settings.updated",
      entityType: "platform_settings",
      entityId: CLICKFUNNELS_WEBHOOK_SETTINGS_KEY,
      metadata: {
        enabled: next.enabled,
        name: next.name,
        affiliateTrackingParam: next.affiliateTrackingParam,
        secretHeaderName: next.secretHeaderName,
        webhookSecretRotated: Boolean(input.regenerateSecret),
        webhookSecretUpdated: Boolean(
          input.regenerateSecret ||
            (typeof input.webhookSecret === "string" && input.webhookSecret.trim()),
        ),
      },
    },
  });

  return toClickFunnelsWebhookSettingsApi(next);
}

export async function resolvePublisherFromAffiliateRef(ref: string | null | undefined) {
  const affiliateRef = ref?.trim() || null;
  if (!affiliateRef) return { publisherId: null as string | null, affiliateRef: null as string | null };

  const user = await prisma.user.findFirst({
    where: { id: affiliateRef, role: "PUBLISHER" },
    select: { id: true },
  });

  return {
    publisherId: user?.id ?? null,
    affiliateRef,
  };
}

export async function getWebhookActivitySummary() {
  const [total, processed, failed, last] = await Promise.all([
    prisma.webhookEvent.count(),
    prisma.webhookEvent.count({ where: { status: "PROCESSED" } }),
    prisma.webhookEvent.count({ where: { status: "FAILED" } }),
    prisma.webhookEvent.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    totalReceived: total,
    processed,
    failed,
    lastActivityAt: last?.createdAt?.toISOString() ?? null,
  };
}

export async function listWebhookActivity(
  opts: {
    page?: number;
    limit?: number;
    status?: WebhookEventStatus;
    q?: string;
    from?: string;
    to?: string;
  } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.WebhookEventWhereInput = {};

  if (opts.status) {
    where.status = opts.status;
  }

  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { leadEmail: { contains: q } },
      { leadName: { contains: q } },
      { eventType: { contains: q } },
      { affiliateRef: { contains: q } },
    ];
  }

  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) {
      const from = new Date(opts.from);
      if (!Number.isNaN(from.getTime())) where.createdAt.gte = from;
    }
    if (opts.to) {
      const to = new Date(opts.to);
      if (!Number.isNaN(to.getTime())) where.createdAt.lte = to;
    }
  }

  const [rows, total, summary] = await Promise.all([
    prisma.webhookEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        source: true,
        eventType: true,
        status: true,
        leadEmail: true,
        leadName: true,
        errorMessage: true,
        affiliateRef: true,
        publisherId: true,
        publisher: {
          select: { id: true, name: true, email: true },
        },
        createdAt: true,
      },
    }),
    prisma.webhookEvent.count({ where }),
    getWebhookActivitySummary(),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      source: row.source,
      eventType: row.eventType,
      status: row.status,
      leadEmail: row.leadEmail,
      leadName: row.leadName,
      errorMessage: row.errorMessage,
      affiliateRef: row.affiliateRef,
      publisherId: row.publisherId,
      publisherName: row.publisher?.name ?? null,
      publisherEmail: row.publisher?.email ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    summary,
  };
}

export async function getWebhookActivityById(id: string) {
  const row = await prisma.webhookEvent.findUnique({
    where: { id },
    include: {
      publisher: { select: { id: true, name: true, email: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    source: row.source,
    eventType: row.eventType,
    status: row.status,
    leadEmail: row.leadEmail,
    leadName: row.leadName,
    errorMessage: row.errorMessage,
    affiliateRef: row.affiliateRef,
    publisherId: row.publisherId,
    publisherName: row.publisher?.name ?? null,
    publisherEmail: row.publisher?.email ?? null,
    payloadJson: row.payloadJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createWebhookEvent(input: {
  source?: "CLICKFUNNELS";
  eventType: string;
  status: WebhookEventStatus;
  leadEmail?: string | null;
  leadName?: string | null;
  errorMessage?: string | null;
  publisherId?: string | null;
  affiliateRef?: string | null;
  payloadJson: unknown;
}) {
  return prisma.webhookEvent.create({
    data: {
      source: input.source ?? "CLICKFUNNELS",
      eventType: input.eventType,
      status: input.status,
      leadEmail: input.leadEmail ?? null,
      leadName: input.leadName ?? null,
      errorMessage: input.errorMessage ?? null,
      publisherId: input.publisherId ?? null,
      affiliateRef: input.affiliateRef ?? null,
      payloadJson: input.payloadJson as never,
    },
  });
}
