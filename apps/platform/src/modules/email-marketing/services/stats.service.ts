import { prisma } from "@/lib/prisma";

export async function getEmailStats(advertiserId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    prisma.emailSend.count({ where: { advertiserId } }),
    prisma.emailSend.count({
      where: { advertiserId, sentAt: { gte: today } },
    }),
    prisma.emailAutomation.count({
      where: { advertiserId, status: "ACTIVE" },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "SUBSCRIBED" },
    }),
    prisma.emailEvent.count({
      where: { type: "OPEN", send: { advertiserId } },
    }),
    prisma.emailEvent.count({
      where: { type: "CLICK", send: { advertiserId } },
    }),
    prisma.emailSend.count({
      where: { advertiserId, status: { in: ["SENT", "DELIVERED"] } },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "BOUNCED" },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "COMPLAINED" },
    }),
    prisma.emailContact.count({
      where: { advertiserId, status: "UNSUBSCRIBED" },
    }),
    prisma.emailSend.count({
      where: { advertiserId, status: "FAILED" },
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

export async function getSendTrend(advertiserId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const sends = await prisma.emailSend.findMany({
    where: { advertiserId, createdAt: { gte: since } },
    select: { createdAt: true, status: true },
  });

  const events = await prisma.emailEvent.findMany({
    where: { send: { advertiserId }, createdAt: { gte: since } },
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

export async function getRecentActivity(advertiserId: string, limit = 10) {
  const sends = await prisma.emailSend.findMany({
    where: { advertiserId },
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
  opts: { page: number; limit: number; status?: string },
) {
  const where = {
    advertiserId,
    ...(opts.status ? { status: opts.status as never } : {}),
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
      const [sent, opens, clicks] = await Promise.all([
        prisma.emailSend.count({
          where: { stepId: step.id, status: { in: ["SENT", "DELIVERED"] } },
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
        opens,
        clicks,
        openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
        clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
      };
    }),
  );

  return { automationId, steps: stepStats };
}
