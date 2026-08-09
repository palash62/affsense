import { prisma } from "@/lib/prisma";

export type StatsSource = "all" | "broadcast" | "automation";

export type StatsScope = {
  source?: StatsSource;
  broadcastId?: string;
  automationId?: string;
};

function normalizeStatsScope(scope?: StatsScope): StatsScope {
  const source = scope?.source ?? "all";
  if (source === "broadcast") {
    return {
      source,
      broadcastId: scope?.broadcastId || undefined,
      automationId: undefined,
    };
  }
  if (source === "automation") {
    return {
      source,
      automationId: scope?.automationId || undefined,
      broadcastId: undefined,
    };
  }
  return { source: "all" };
}

/** Send-level filter for scoped analytics (excludes global-only contact metrics). */
function sendScopeWhere(advertiserId: string, scope?: StatsScope) {
  const s = normalizeStatsScope(scope);
  const base: {
    advertiserId: string;
    broadcastId?: string | { not: null };
    automationId?: string | { not: null };
  } = { advertiserId };

  if (s.source === "broadcast") {
    base.broadcastId = s.broadcastId ? s.broadcastId : { not: null };
  } else if (s.source === "automation") {
    base.automationId = s.automationId ? s.automationId : { not: null };
  }

  return base;
}

export async function assertStatsScopeOwnership(
  advertiserId: string,
  scope?: StatsScope,
): Promise<{ ok: true; scope: StatsScope } | { ok: false }> {
  const s = normalizeStatsScope(scope);
  if (s.source === "broadcast" && s.broadcastId) {
    const row = await prisma.emailBroadcast.findFirst({
      where: { id: s.broadcastId, advertiserId },
      select: { id: true },
    });
    if (!row) return { ok: false };
  }
  if (s.source === "automation" && s.automationId) {
    const row = await prisma.emailAutomation.findFirst({
      where: { id: s.automationId, advertiserId },
      select: { id: true },
    });
    if (!row) return { ok: false };
  }
  return { ok: true, scope: s };
}

export async function getEmailStats(advertiserId: string, scope?: StatsScope) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sendWhere = sendScopeWhere(advertiserId, scope);
  const isScoped = (scope?.source ?? "all") !== "all";

  const [
    totalSends,
    sentToday,
    activeAutomations,
    totalContacts,
    opens,
    clicks,
    delivered,
    bounced,
    complained,
    unsubscribed,
    failed,
    totalTemplates,
  ] = await Promise.all([
    prisma.emailSend.count({ where: sendWhere }),
    prisma.emailSend.count({
      where: { ...sendWhere, sentAt: { gte: today } },
    }),
    prisma.emailAutomation.count({
      where: { advertiserId, status: "ACTIVE" },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "SUBSCRIBED" },
    }),
    prisma.emailEvent.count({
      where: { type: "OPEN", send: sendWhere },
    }),
    prisma.emailEvent.count({
      where: { type: "CLICK", send: sendWhere },
    }),
    prisma.emailSend.count({
      where: {
        ...sendWhere,
        status: { in: ["SENT", "DELIVERED"] },
      },
    }),
    isScoped
      ? prisma.emailSend.count({
          where: { ...sendWhere, status: "BOUNCED" },
        })
      : prisma.emailContact.count({
          where: { advertiserId, status: "BOUNCED" },
        }),
    prisma.emailContact.count({
      where: { advertiserId, status: "COMPLAINED" },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "UNSUBSCRIBED" },
    }),
    prisma.emailSend.count({
      where: { ...sendWhere, status: "FAILED" },
    }),
    prisma.emailTemplate.count({ where: { advertiserId } }),
  ]);

  const openRate = delivered > 0 ? Math.round((opens / delivered) * 100) : 0;
  const clickRate = delivered > 0 ? Math.round((clicks / delivered) * 100) : 0;

  return {
    totalSends,
    sentToday,
    activeAutomations,
    totalContacts,
    opens,
    clicks,
    delivered,
    openRate,
    clickRate,
    bounced,
    complained,
    unsubscribed,
    failed,
    totalTemplates,
  };
}

export async function getSendTrend(
  advertiserId: string,
  days = 30,
  scope?: StatsScope,
) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const sendWhere = sendScopeWhere(advertiserId, scope);

  const sends = await prisma.emailSend.findMany({
    where: { ...sendWhere, createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });

  const events = await prisma.emailEvent.findMany({
    where: { send: sendWhere, createdAt: { gte: since } },
    select: { createdAt: true, type: true },
  });

  const buckets = new Map<string, { sends: number; opens: number; clicks: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    buckets.set(d.toISOString().slice(0, 10), { sends: 0, opens: 0, clicks: 0 });
  }

  for (const s of sends) {
    const key = s.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) b.sends++;
  }

  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      if (e.type === "OPEN") b.opens++;
      else if (e.type === "CLICK") b.clicks++;
    }
  }

  return Array.from(buckets.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

export async function getRecentActivity(
  advertiserId: string,
  limit = 10,
  scope?: StatsScope,
) {
  const sendWhere = sendScopeWhere(advertiserId, scope);
  const sends = await prisma.emailSend.findMany({
    where: sendWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      contact: { select: { email: true, firstName: true } },
      automation: { select: { name: true } },
      template: { select: { subject: true } },
      events: { select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return sends.map((s) => {
    const lastEvent = s.events[0];
    const action =
      lastEvent?.type === "CLICK"
        ? "Clicked"
        : lastEvent?.type === "OPEN"
          ? "Opened"
          : s.status === "SENT" || s.status === "DELIVERED"
            ? "Delivered"
            : s.status === "FAILED"
              ? "Failed"
              : "Queued";

    return {
      id: s.id,
      action,
      detail: `${s.contact.email} — ${s.template.subject}`,
      time: s.sentAt?.toISOString() ?? s.createdAt.toISOString(),
      automationName: s.automation?.name ?? null,
    };
  });
}

export async function listSends(
  advertiserId: string,
  opts: { page: number; limit: number; status?: string; search?: string },
) {
  const search = opts.search?.trim();
  const where = {
    advertiserId,
    ...(opts.status ? { status: opts.status as never } : {}),
    ...(search
      ? {
          OR: [
            { contact: { email: { contains: search } } },
            { contact: { firstName: { contains: search } } },
            { contact: { lastName: { contains: search } } },
            { template: { subject: { contains: search } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.emailSend.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      include: {
        contact: { select: { email: true, firstName: true, lastName: true } },
        automation: { select: { name: true } },
        template: { select: { subject: true } },
        events: { select: { type: true } },
      },
    }),
    prisma.emailSend.count({ where }),
  ]);

  return {
    items: items.map((s) => ({
      ...s,
      hasOpen: s.events.some((e) => e.type === "OPEN"),
      hasClick: s.events.some((e) => e.type === "CLICK"),
      events: undefined,
    })),
    total,
    page: opts.page,
    limit: opts.limit,
    totalPages: Math.max(1, Math.ceil(total / opts.limit)),
  };
}

export async function getAutomationStepStats(advertiserId: string, automationId: string) {
  const automation = await prisma.emailAutomation.findFirst({
    where: { id: automationId, advertiserId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!automation) return null;

  const stepStats = await Promise.all(
    automation.steps.map(async (step) => {
      const [sent, delivered, bounced, opens, clicks] = await Promise.all([
        prisma.emailSend.count({
          where: { stepId: step.id, status: { in: ["SENT", "DELIVERED"] } },
        }),
        prisma.emailSend.count({
          where: { stepId: step.id, status: "DELIVERED" },
        }),
        prisma.emailSend.count({
          where: { stepId: step.id, status: "BOUNCED" },
        }),
        prisma.emailEvent.count({
          where: { type: "OPEN", send: { stepId: step.id } },
        }),
        prisma.emailEvent.count({
          where: { type: "CLICK", send: { stepId: step.id } },
        }),
      ]);
      return {
        stepId: step.id,
        order: step.order,
        delayMinutes: step.delayMinutes,
        sent,
        delivered,
        bounced,
        opens,
        clicks,
        openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
      };
    }),
  );

  return { automationId, steps: stepStats };
}

export type AutomationMetric =
  | "sent"
  | "delivered"
  | "bounced"
  | "opened"
  | "clicked";

export async function listAutomationMetricRecipients(
  advertiserId: string,
  automationId: string,
  opts: {
    metric: AutomationMetric;
    stepId?: string | null;
    page: number;
    limit: number;
  },
) {
  const automation = await prisma.emailAutomation.findFirst({
    where: { id: automationId, advertiserId },
    select: {
      id: true,
      name: true,
      steps: { select: { id: true } },
    },
  });
  if (!automation) return null;

  if (opts.stepId) {
    const belongs = automation.steps.some((s) => s.id === opts.stepId);
    if (!belongs) return null;
  }

  const baseWhere = {
    advertiserId,
    automationId,
    ...(opts.stepId ? { stepId: opts.stepId } : {}),
  };

  const eventType =
    opts.metric === "opened" ? ("OPEN" as const) : opts.metric === "clicked" ? ("CLICK" as const) : null;

  const where =
    opts.metric === "sent"
      ? { ...baseWhere, status: { in: ["SENT" as const, "DELIVERED" as const] } }
      : opts.metric === "delivered"
        ? { ...baseWhere, status: "DELIVERED" as const }
        : opts.metric === "bounced"
          ? { ...baseWhere, status: "BOUNCED" as const }
          : {
              ...baseWhere,
              events: { some: { type: eventType! } },
            };

  const [rows, total] = await Promise.all([
    prisma.emailSend.findMany({
      where,
      orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
      select: {
        id: true,
        status: true,
        sentAt: true,
        createdAt: true,
        contact: {
          select: { email: true, firstName: true, lastName: true },
        },
        ...(eventType != null
          ? {
              events: {
                where: { type: eventType },
                orderBy: { createdAt: "desc" as const },
                take: 1,
                select: { createdAt: true, type: true },
              },
            }
          : {}),
      },
    }),
    prisma.emailSend.count({ where }),
  ]);

  return {
    automationId: automation.id,
    automationName: automation.name,
    metric: opts.metric,
    stepId: opts.stepId ?? null,
    items: rows.map((row) => {
      const events =
        "events" in row && Array.isArray(row.events) ? row.events : [];
      const lastEvent = events[0] as { createdAt: Date } | undefined;
      return {
        sendId: row.id,
        email: row.contact.email,
        firstName: row.contact.firstName,
        lastName: row.contact.lastName,
        status: row.status,
        sentAt: row.sentAt?.toISOString() ?? null,
        lastEventAt: lastEvent?.createdAt.toISOString() ?? null,
      };
    }),
    total,
    page: opts.page,
    limit: opts.limit,
    totalPages: Math.max(1, Math.ceil(total / opts.limit)),
  };
}

export async function getBroadcastStats(advertiserId: string, broadcastId: string) {
  const broadcast = await prisma.emailBroadcast.findFirst({
    where: { id: broadcastId, advertiserId },
    select: {
      id: true,
      name: true,
      status: true,
      recipientCount: true,
      sentCount: true,
      failedCount: true,
      scheduledAt: true,
      createdAt: true,
    },
  });
  if (!broadcast) return null;

  const [sent, delivered, bounced, failed, opens, clicks, complaints] =
    await Promise.all([
      prisma.emailSend.count({
        where: { broadcastId, status: { in: ["SENT", "DELIVERED"] } },
      }),
      prisma.emailSend.count({
        where: { broadcastId, status: "DELIVERED" },
      }),
      prisma.emailSend.count({
        where: { broadcastId, status: "BOUNCED" },
      }),
      prisma.emailSend.count({
        where: { broadcastId, status: "FAILED" },
      }),
      prisma.emailEvent.count({
        where: { type: "OPEN", send: { broadcastId } },
      }),
      prisma.emailEvent.count({
        where: { type: "CLICK", send: { broadcastId } },
      }),
      prisma.emailEvent.count({
        where: { type: "COMPLAINT", send: { broadcastId } },
      }),
    ]);

  const rateBase = sent > 0 ? sent : 0;
  return {
    broadcastId: broadcast.id,
    name: broadcast.name,
    status: broadcast.status,
    recipientCount: broadcast.recipientCount,
    sentCount: broadcast.sentCount,
    failedCount: broadcast.failedCount,
    scheduledAt: broadcast.scheduledAt,
    createdAt: broadcast.createdAt,
    sent,
    delivered,
    bounced,
    failed,
    opens,
    clicks,
    complaints,
    openRate: rateBase > 0 ? Math.round((opens / rateBase) * 100) : 0,
    clickRate: rateBase > 0 ? Math.round((clicks / rateBase) * 100) : 0,
    bounceRate: rateBase > 0 ? Math.round((bounced / rateBase) * 100) : 0,
  };
}
