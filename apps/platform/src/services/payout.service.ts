import { prisma } from "@/lib/prisma";
import {
  debitWalletForPayout,
  getPlatformSettings,
  holdWalletFunds,
  releaseWalletHold,
} from "@/services/wallet.service";
import {
  debitCpaWalletForPayout,
  releaseCpaWalletHold,
} from "@/services/cpa-wallet.service";
import { Errors } from "@/lib/errors";
import { getMinPayoutForMethod } from "@/lib/platform-settings";
import { isPendingPayoutStatus, PENDING_PAYOUT_STATUSES } from "@/lib/payout-status";
import { payoutPublisherSelect, payoutCpaPublisherSelect, serializePayoutForClient } from "@/lib/payout";
import type { PayoutPaymentDetails } from "@/lib/payout-payment-details";
import type { Prisma, PayoutKind, PayoutMethod } from "@prisma/client";
import { REFERRAL_MIN_PAYOUT } from "@/lib/referral";
import { getReferralBalanceSummary } from "@/services/referral.service";
import {
  notifyAdminAlert,
  notifyApproved,
  notifyRejected,
} from "@/services/notify.service";

export const PUBLISHER_PAYOUT_REQUEST_COOLDOWN_DAYS = 7;

export type PublisherPayoutRequestEligibility = {
  canRequest: boolean;
  lastRequestAt?: Date;
  nextAllowedAt?: Date;
};

export async function getPublisherPayoutRequestEligibility(
  publisherId: string,
): Promise<PublisherPayoutRequestEligibility> {
  const since = new Date();
  since.setDate(since.getDate() - PUBLISHER_PAYOUT_REQUEST_COOLDOWN_DAYS);

  const recent = await prisma.payout.findFirst({
    where: {
      publisherId,
      kind: "PUBLISHER",
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!recent) {
    return { canRequest: true };
  }

  const nextAllowedAt = new Date(recent.createdAt);
  nextAllowedAt.setDate(nextAllowedAt.getDate() + PUBLISHER_PAYOUT_REQUEST_COOLDOWN_DAYS);

  return {
    canRequest: false,
    lastRequestAt: recent.createdAt,
    nextAllowedAt,
  };
}

export async function requestPayout(
  publisherId: string,
  amount: number,
  method: PayoutMethod,
  paymentDetails: PayoutPaymentDetails,
  idempotencyKey?: string,
) {
  const settings = await getPlatformSettings();
  const minAmount = getMinPayoutForMethod(method, settings);

  if (amount < minAmount) {
    throw Errors.payoutBelowMinimum(minAmount);
  }

  if (idempotencyKey) {
    const existing = await prisma.payout.findUnique({
      where: { idempotencyKey },
    });
    if (existing) throw Errors.duplicatePayout();
  }

  const eligibility = await getPublisherPayoutRequestEligibility(publisherId);
  if (!eligibility.canRequest && eligibility.nextAllowedAt) {
    throw Errors.payoutWeeklyLimit(eligibility.nextAllowedAt);
  }

  const wallet = await prisma.wallet.findUniqueOrThrow({
    where: { userId: publisherId },
  });

  const available = Number(wallet.balance) - Number(wallet.holdBalance);
  if (available < amount) {
    throw Errors.insufficientFunds();
  }

  const payout = await prisma.$transaction(async (tx) => {
    await holdWalletFunds(tx, publisherId, amount);

    return tx.payout.create({
      data: {
        publisherId,
        kind: "PUBLISHER",
        amount,
        method,
        paymentDetails: paymentDetails as Prisma.InputJsonValue,
        idempotencyKey,
        status: "PENDING",
      },
      include: { publisher: { select: { id: true, name: true, email: true } } },
    });
  });

  void notifyAdminAlert({
    title: "New publisher payout request",
    message: `${payout.publisher.name} requested ${method} payout of $${amount.toFixed(2)}.`,
    actionPath: "/admin/payout-center",
    metadata: { payoutId: payout.id },
  });

  return payout;
}

export async function requestReferralPayout(
  advertiserId: string,
  amount: number,
  method: PayoutMethod,
  paymentDetails: PayoutPaymentDetails,
  idempotencyKey?: string,
) {
  if (amount < REFERRAL_MIN_PAYOUT) {
    throw Errors.payoutBelowMinimum(REFERRAL_MIN_PAYOUT);
  }

  if (idempotencyKey) {
    const existing = await prisma.payout.findUnique({
      where: { idempotencyKey },
    });
    if (existing) throw Errors.duplicatePayout();
  }

  const user = await prisma.user.findUnique({
    where: { id: advertiserId },
    select: { role: true },
  });

  if (user?.role !== "ADVERTISER") {
    throw Errors.forbidden();
  }

  const balance = await getReferralBalanceSummary(advertiserId);

  if (amount > balance.withdrawableReferral) {
    throw Errors.insufficientFunds();
  }

  if (amount > balance.availableBalance) {
    throw Errors.insufficientFunds();
  }

  const payout = await prisma.$transaction(async (tx) => {
    await holdWalletFunds(tx, advertiserId, amount);

    return tx.payout.create({
      data: {
        publisherId: advertiserId,
        kind: "REFERRAL",
        amount,
        method,
        paymentDetails: paymentDetails as Prisma.InputJsonValue,
        idempotencyKey,
        status: "PENDING",
      },
      include: { publisher: { select: { id: true, name: true, email: true } } },
    });
  });

  void notifyAdminAlert({
    title: "New referral payout request",
    message: `${payout.publisher.name} requested referral ${method} payout of $${amount.toFixed(2)}.`,
    actionPath: "/admin/payout-center",
    metadata: { payoutId: payout.id },
  });

  return payout;
}

export async function approvePayout(payoutId: string, adminId: string) {
  const payout = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
  });

  if (!isPendingPayoutStatus(payout.status)) {
    throw new Error("Payout is not pending approval");
  }

  await prisma.$transaction(async (tx) => {
    if (payout.kind === "CPA") {
      await debitCpaWalletForPayout(tx, payout.publisherId, Number(payout.amount));
    } else {
      await debitWalletForPayout(
        tx,
        payout.publisherId,
        Number(payout.amount),
        payoutId,
        payout.kind === "REFERRAL" ? "Referral payout processed" : "Payout processed",
        payout.kind === "REFERRAL" ? "referral_payout" : "payout",
      );
    }

    await tx.payout.update({
      where: { id: payoutId },
      data: { status: "COMPLETED", processedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "payout.approved",
        entityType: "payout",
        entityId: payoutId,
      },
    });
  });

  const updated = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
    include: { publisher: { select: { id: true, name: true, email: true } } },
  });

  void notifyApproved(
    updated.publisher,
    "Payout request",
    `$${Number(updated.amount).toFixed(2)} has been processed to your payment method.`,
    "payout.approved",
  );

  return updated;
}

export async function rejectPayout(payoutId: string, adminId: string, reason: string) {
  const payout = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
  });

  if (!isPendingPayoutStatus(payout.status)) {
    throw new Error("Payout is not pending approval");
  }

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("Rejection note is required");
  }

  await prisma.$transaction(async (tx) => {
    if (payout.kind === "CPA") {
      await releaseCpaWalletHold(tx, payout.publisherId, Number(payout.amount));
    } else {
      await releaseWalletHold(tx, payout.publisherId, Number(payout.amount));
    }

    await tx.payout.update({
      where: { id: payoutId },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        rejectionReason: trimmedReason,
        rejectedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "payout.rejected",
        entityType: "payout",
        entityId: payoutId,
        metadata: { reason: trimmedReason },
      },
    });
  });

  const updated = await prisma.payout.findUniqueOrThrow({
    where: { id: payoutId },
    include: { publisher: { select: { id: true, name: true, email: true } } },
  });

  void notifyRejected(
    updated.publisher,
    "Payout request",
    trimmedReason,
    undefined,
    "payout.rejected",
  );

  return updated;
}

export async function listPendingPayouts() {
  const rows = await prisma.payout.findMany({
    where: {
      status: { in: [...PENDING_PAYOUT_STATUSES] },
      kind: { in: ["PUBLISHER", "REFERRAL"] },
    },
    include: { publisher: { select: payoutPublisherSelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializePayoutForClient);
}

export async function listPendingCpaPayouts() {
  const rows = await prisma.payout.findMany({
    where: {
      status: { in: [...PENDING_PAYOUT_STATUSES] },
      kind: "CPA",
    },
    include: { publisher: { select: payoutCpaPublisherSelect } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(serializePayoutForClient);
}

export async function listAdminPayouts(options: {
  publisherId?: string;
  kind?: PayoutKind | "all";
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PayoutWhereInput = {};

  if (options.publisherId) {
    where.publisherId = options.publisherId;
  }

  if (options.kind && options.kind !== "all") {
    where.kind = options.kind;
  }

  if (options.status && options.status !== "all") {
    where.status = options.status as never;
  }

  if (options.dateFrom || options.dateTo) {
    where.createdAt = {};
    if (options.dateFrom) {
      const from = new Date(options.dateFrom);
      from.setHours(0, 0, 0, 0);
      where.createdAt.gte = from;
    }
    if (options.dateTo) {
      const to = new Date(options.dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const publisherSelect =
    options.kind === "CPA" ? payoutCpaPublisherSelect : payoutPublisherSelect;

  const [data, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: { publisher: { select: publisherSelect } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payout.count({ where }),
  ]);

  return {
    data: data.map(serializePayoutForClient),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listPayoutPublisherOptions() {
  return prisma.user.findMany({
    where: { role: "PUBLISHER" },
    select: {
      id: true,
      name: true,
      email: true,
      publisherProfile: { select: { website: true } },
    },
    orderBy: { name: "asc" },
  });
}

function payoutOrderBy(sort?: string): Prisma.PayoutOrderByWithRelationInput {
  switch (sort) {
    case "created_asc":
      return { createdAt: "asc" };
    case "amount_asc":
      return { amount: "asc" };
    case "amount_desc":
      return { amount: "desc" };
    case "status_asc":
      return { status: "asc" };
    case "status_desc":
      return { status: "desc" };
    case "method_asc":
      return { method: "asc" };
    case "method_desc":
      return { method: "desc" };
    case "created_desc":
    default:
      return { createdAt: "desc" };
  }
}

export async function listPayouts(filters: {
  publisherId?: string;
  kind?: PayoutKind | "all";
  status?: string;
  method?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PayoutWhereInput = {};

  if (filters.publisherId) {
    where.publisherId = filters.publisherId;
  }

  if (filters.kind && filters.kind !== "all") {
    where.kind = filters.kind;
  }

  if (filters.status && filters.status !== "all") {
    where.status = filters.status as never;
  }

  if (filters.method && filters.method !== "all") {
    where.method = filters.method as never;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      where.createdAt.gte = from;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  const [data, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: { publisher: { select: { name: true, email: true } } },
      orderBy: payoutOrderBy(filters.sort),
      skip,
      take: limit,
    }),
    prisma.payout.count({ where }),
  ]);

  return {
    data: data.map((row) =>
      serializePayoutForClient({
        ...row,
        publisher: {
          name: row.publisher.name,
          email: row.publisher.email,
          wallet: null,
          publisherProfile: null,
        },
      }),
    ),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
