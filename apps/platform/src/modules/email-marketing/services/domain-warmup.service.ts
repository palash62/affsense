import { prisma } from "@/lib/prisma";

export const WARMUP_DAY1_LIMIT = 50;
export const WARMUP_DAILY_GROWTH = 1.1;
export const WARMUP_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DomainWarmupStatus = {
  domain: string;
  warmingUp: boolean;
  day: number;
  dailyLimit: number | null;
  sentToday: number;
  remainingToday: number | null;
  warmupStartedAt: string | null;
  daysRemaining: number | null;
  estimatedDaysToSend: number | null;
};

function startOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function nextLocalMidnight(from = new Date()): Date {
  const next = startOfLocalDay(from);
  next.setDate(next.getDate() + 1);
  return next;
}

export function dailyWarmupLimit(day: number): number {
  if (day < 1) return WARMUP_DAY1_LIMIT;
  return Math.floor(WARMUP_DAY1_LIMIT * Math.pow(WARMUP_DAILY_GROWTH, day - 1));
}

export function warmupDayIndex(warmupStartedAt: Date | null, now = new Date()): number {
  if (!warmupStartedAt) return 1;
  const start = startOfLocalDay(warmupStartedAt);
  const today = startOfLocalDay(now);
  const diff = Math.floor((today.getTime() - start.getTime()) / DAY_MS);
  return Math.max(1, diff + 1);
}

function domainSuffix(domain: string): string {
  return `@${domain.trim().toLowerCase()}`;
}

export async function countBroadcastSendsTodayForDomain(
  advertiserId: string,
  domain: string,
  now = new Date(),
): Promise<number> {
  const dayStart = startOfLocalDay(now);
  const normalized = domain.trim().toLowerCase();
  return prisma.emailSend.count({
    where: {
      advertiserId,
      status: { in: ["SENT", "DELIVERED"] },
      sentAt: { gte: dayStart },
      broadcastId: { not: null },
      broadcast: {
        fromEmail: { endsWith: domainSuffix(normalized) },
      },
    },
  });
}

async function findEarliestBroadcastSendAt(
  advertiserId: string,
  domain: string,
): Promise<Date | null> {
  const normalized = domain.trim().toLowerCase();
  const first = await prisma.emailSend.findFirst({
    where: {
      advertiserId,
      status: { in: ["SENT", "DELIVERED"] },
      sentAt: { not: null },
      broadcastId: { not: null },
      broadcast: {
        fromEmail: { endsWith: domainSuffix(normalized) },
      },
    },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });
  return first?.sentAt ?? null;
}

async function resolveIdentityWarmupStart(
  advertiserId: string,
  domain: string,
): Promise<{
  identityId: string;
  domain: string;
  warmupStartedAt: Date | null;
} | null> {
  const normalized = domain.trim().toLowerCase();
  const identity = await prisma.advertiserSendingIdentity.findUnique({
    where: {
      advertiserId_domain: { advertiserId, domain: normalized },
    },
    select: { id: true, domain: true, warmupStartedAt: true },
  });
  if (!identity) return null;

  if (identity.warmupStartedAt) {
    return {
      identityId: identity.id,
      domain: identity.domain,
      warmupStartedAt: identity.warmupStartedAt,
    };
  }

  const earliest = await findEarliestBroadcastSendAt(advertiserId, normalized);
  if (!earliest) {
    return {
      identityId: identity.id,
      domain: identity.domain,
      warmupStartedAt: null,
    };
  }

  const updated = await prisma.advertiserSendingIdentity.update({
    where: { id: identity.id },
    data: { warmupStartedAt: earliest },
    select: { id: true, domain: true, warmupStartedAt: true },
  });

  return {
    identityId: updated.id,
    domain: updated.domain,
    warmupStartedAt: updated.warmupStartedAt,
  };
}

export function estimateDaysToSend(
  recipientCount: number,
  remainingToday: number,
  currentDay: number,
): number | null {
  if (recipientCount <= 0) return 0;
  if (currentDay > WARMUP_DAYS) return 1;

  let remaining = recipientCount;
  let day = currentDay;
  let days = 0;
  const cap = remainingToday;

  if (cap > 0) {
    remaining -= Math.min(remaining, cap);
    days += 1;
    day += 1;
  } else {
    // No capacity left today — start counting from tomorrow
    day += 1;
  }

  while (remaining > 0 && days < 365) {
    if (day > WARMUP_DAYS) {
      days += 1;
      break;
    }
    const limit = dailyWarmupLimit(day);
    remaining -= Math.min(remaining, limit);
    days += 1;
    day += 1;
  }

  return days;
}

export async function getDomainWarmupStatus(
  advertiserId: string,
  domain: string,
  opts?: { recipientCount?: number; now?: Date },
): Promise<DomainWarmupStatus | null> {
  const now = opts?.now ?? new Date();
  const resolved = await resolveIdentityWarmupStart(advertiserId, domain);
  if (!resolved) return null;

  const day = warmupDayIndex(resolved.warmupStartedAt, now);
  const warmingUp = day <= WARMUP_DAYS;
  const dailyLimit = warmingUp ? dailyWarmupLimit(day) : null;
  const sentToday = await countBroadcastSendsTodayForDomain(
    advertiserId,
    resolved.domain,
    now,
  );
  const remainingToday =
    dailyLimit == null ? null : Math.max(0, dailyLimit - sentToday);
  const daysRemaining = warmingUp ? WARMUP_DAYS - day + 1 : null;

  let estimatedDaysToSend: number | null = null;
  if (opts?.recipientCount != null && warmingUp && remainingToday != null) {
    estimatedDaysToSend = estimateDaysToSend(
      opts.recipientCount,
      remainingToday,
      day,
    );
  } else if (opts?.recipientCount != null && !warmingUp) {
    estimatedDaysToSend = opts.recipientCount > 0 ? 1 : 0;
  }

  return {
    domain: resolved.domain,
    warmingUp,
    day: warmingUp ? day : day,
    dailyLimit,
    sentToday,
    remainingToday,
    warmupStartedAt: resolved.warmupStartedAt?.toISOString() ?? null,
    daysRemaining,
    estimatedDaysToSend,
  };
}

export async function ensureWarmupStarted(
  identityId: string,
  sentAt = new Date(),
): Promise<void> {
  await prisma.advertiserSendingIdentity.updateMany({
    where: { id: identityId, warmupStartedAt: null },
    data: { warmupStartedAt: sentAt },
  });
}

export async function shouldDeferBroadcastSend(
  advertiserId: string,
  domain: string,
  now = new Date(),
): Promise<{ defer: false } | { defer: true; until: Date; status: DomainWarmupStatus }> {
  const status = await getDomainWarmupStatus(advertiserId, domain, { now });
  if (!status || !status.warmingUp || status.dailyLimit == null) {
    return { defer: false };
  }
  if (status.sentToday < status.dailyLimit) {
    return { defer: false };
  }
  return {
    defer: true,
    until: nextLocalMidnight(now),
    status,
  };
}

/** Resolve domain from an email address. */
export function domainFromEmail(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return domain || null;
}
