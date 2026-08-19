import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Errors } from "@/lib/errors";
import { getLeadCpl } from "@/lib/lead-cpl";
import {
  calculatePublisherPayout,
  parsePlatformSettings,
} from "@/lib/platform-settings";
import { shouldCreditPublisherForLead } from "@/lib/publisher-leads";
import {
  crossedLowBalanceTiers,
  parseLowBalanceAlertTiers,
  recoveredLowBalanceTiers,
  type LowBalanceTier,
} from "@/lib/low-balance-alerts";
import {
  notifyAdminAlert,
  notifyApproved,
  notifyCampaignBudgetReached,
  notifyGeneric,
  notifyLowBalanceTiers,
  notifyRejected,
  notifyUserById,
} from "@/services/notify.service";

export async function getPlatformSettings() {
  const settings = await prisma.platformSetting.findMany();
  const map: Record<string, unknown> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }
  return parsePlatformSettings(map);
}

export async function creditWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string,
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  const newBalance = Number(wallet.balance) + amount;
  const previousTiers = parseLowBalanceAlertTiers(wallet.lowBalanceAlertTiers);
  const nextTiers = recoveredLowBalanceTiers(newBalance, previousTiers);

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      lowBalanceAlertTiers: nextTiers,
    },
  });

  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      type: "CREDIT",
      amount,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      description,
    },
  });

  return newBalance;
}

export type DebitWalletResult = {
  previousBalance: number;
  newBalance: number;
  crossedTiers: LowBalanceTier[];
};

export async function debitWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string,
): Promise<DebitWalletResult> {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  const current = Number(wallet.balance);

  if (current < amount) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  const newBalance = current - amount;
  const previousTiers = parseLowBalanceAlertTiers(wallet.lowBalanceAlertTiers);
  const crossedTiers = crossedLowBalanceTiers(current, newBalance, previousTiers);
  const nextTiers = [...new Set([...previousTiers, ...crossedTiers])].sort(
    (a, b) => b - a,
  );

  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      balance: newBalance,
      ...(crossedTiers.length > 0 ? { lowBalanceAlertTiers: nextTiers } : {}),
    },
  });

  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      type: "DEBIT",
      amount,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      description,
    },
  });

  return { previousBalance: current, newBalance, crossedTiers };
}

/** Debit wallet without balance check — used for lead payment clawbacks. */
export async function forceDebitWallet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  referenceType: string,
  referenceId: string,
  description?: string,
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  const newBalance = Number(wallet.balance) - amount;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  });

  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      type: "DEBIT",
      amount,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      description,
    },
  });

  return newBalance;
}

export async function holdWalletFunds(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  const available = Number(wallet.balance) - Number(wallet.holdBalance);
  if (available < amount) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { holdBalance: Number(wallet.holdBalance) + amount },
  });
}

export async function releaseWalletHold(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  await tx.wallet.update({
    where: { id: wallet.id },
    data: {
      holdBalance: Math.max(0, Number(wallet.holdBalance) - amount),
    },
  });
}

/** Debit balance and release the matching hold (payout approval). */
export async function debitWalletForPayout(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  referenceId: string,
  description?: string,
  referenceType: "payout" | "referral_payout" = "payout",
) {
  const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
  const balance = Number(wallet.balance);
  const hold = Number(wallet.holdBalance);

  if (balance < amount || hold < amount) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  const newBalance = balance - amount;
  const newHold = hold - amount;

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance, holdBalance: newHold },
  });

  await tx.ledgerEntry.create({
    data: {
      walletId: wallet.id,
      type: "DEBIT",
      amount,
      balanceAfter: newBalance,
      referenceType,
      referenceId,
      description,
    },
  });

  return newBalance;
}

export async function ensurePublisherWallet(
  userId: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return db.wallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export async function processLeadPayment(leadId: string) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      campaign: true,
      publisher: { select: { role: true } },
    },
  });

  if (lead.isTest) {
    throw Errors.validation("Test leads cannot be paid.");
  }

  const settings = await getPlatformSettings();
  const cpl = getLeadCpl(lead);
  const { publisherAmount, platformFee } = calculatePublisherPayout(
    cpl,
    lead.country,
    settings,
  );
  const feePercent = cpl > 0 ? Math.round((platformFee / cpl) * 10000) / 100 : 0;

  await prisma.$transaction(async (tx) => {
    const debit = await debitWallet(
      tx,
      lead.campaign.advertiserId,
      cpl,
      "lead",
      leadId,
      `Lead payment for campaign ${lead.campaign.name}`,
    );

    if (shouldCreditPublisherForLead(lead)) {
      await ensurePublisherWallet(lead.publisherId, tx);
      await creditWallet(
        tx,
        lead.publisherId,
        publisherAmount,
        "lead",
        leadId,
        `Earnings from lead`,
      );
    }

    await tx.platformFee.create({
      data: {
        leadId,
        feeAmount: platformFee,
        feePercent,
      },
    });

    const previousSpent = Number(lead.campaign.spent);
    const spent = previousSpent + cpl;
    const budget =
      lead.campaign.budget == null ? null : Number(lead.campaign.budget);
    const crossedBudget =
      budget != null && previousSpent < budget && spent >= budget;

    await tx.campaign.update({
      where: { id: lead.campaignId },
      data: { spent },
    });

    await tx.lead.update({
      where: { id: leadId },
      data: { status: "PAID", cpl },
    });

    const { creditReferralCommissionsForLead } = await import("@/services/referral.service");
    const referralCredits = await creditReferralCommissionsForLead(
      tx,
      leadId,
      lead.campaign.advertiserId,
      cpl,
    );

    return {
      crossedBudget,
      campaignId: lead.campaignId,
      campaignName: lead.campaign.name,
      budget,
      spent,
      cpl,
      advertiserId: lead.campaign.advertiserId,
      crossedTiers: debit.crossedTiers,
      newBalance: debit.newBalance,
      referralCredits,
    };
  }).then(async (result) => {
    if (result?.crossedTiers?.length) {
      void notifyLowBalanceTiers(result.advertiserId, result.crossedTiers, result.newBalance);
    }

    if (result?.crossedBudget && result.budget != null) {
      void notifyCampaignBudgetReached(result.advertiserId, {
        campaignId: result.campaignId,
        campaignName: result.campaignName,
        budget: result.budget,
        spent: result.spent,
        cpl: result.cpl,
      });
    }

    if (result?.referralCredits?.length) {
      const { notifyReferralCommission } = await import("@/services/notify.service");
      for (const credit of result.referralCredits) {
        void notifyReferralCommission(credit.referrerId, {
          amount: credit.amount,
          level: credit.level,
        });
      }
    }
  });

  void import("@/services/publisher-postback-dispatch")
    .then(({ dispatchPublisherPostback }) => dispatchPublisherPostback(leadId))
    .catch((error) => {
      console.error("[publisher-postback] dispatch failed", leadId, error);
    });
}

async function reverseLeadPaymentInTx(
  tx: Prisma.TransactionClient,
  leadId: string,
  reason?: string,
) {
  const existingReversal = await tx.ledgerEntry.findFirst({
    where: { referenceType: "lead_reversal", referenceId: leadId },
  });
  if (existingReversal) {
    return { alreadyReversed: true as const, cpl: 0 };
  }

  const lead = await tx.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { campaign: true },
  });

  if (lead.status !== "PAID") {
    throw Errors.validation("Lead is not paid; nothing to reverse.");
  }

  const originalEntries = await tx.ledgerEntry.findMany({
    where: {
      referenceId: leadId,
      referenceType: { in: ["lead", "referral"] },
    },
    include: { wallet: { select: { userId: true } } },
  });

  let cpl = 0;
  const reversalDesc = reason ? `Lead reversal: ${reason}` : "Lead payment reversal";

  for (const entry of originalEntries) {
    const amount = Number(entry.amount);
    if (entry.referenceType === "lead" && entry.type === "DEBIT") {
      cpl = amount;
      await creditWallet(tx, entry.wallet.userId, amount, "lead_reversal", leadId, reversalDesc);
    } else if (entry.type === "CREDIT") {
      await forceDebitWallet(
        tx,
        entry.wallet.userId,
        amount,
        "lead_reversal",
        leadId,
        reversalDesc,
      );
    }
  }

  if (cpl === 0) {
    throw Errors.validation("No payment ledger entries found for this lead.");
  }

  await tx.platformFee.deleteMany({ where: { leadId } });

  const newSpent = Math.max(0, Number(lead.campaign.spent) - cpl);

  await tx.campaign.update({
    where: { id: lead.campaignId },
    data: { spent: newSpent },
  });

  return { alreadyReversed: false as const, cpl };
}

/** Pause reason used when a campaign cannot fund the next lead. */
export const PAUSED_REASON_INSUFFICIENT_FUNDS = "Insufficient wallet balance";

export async function reactivateCampaignsForFunds(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  return tx.campaign.updateMany({
    where: {
      advertiserId: userId,
      status: "PAUSED",
      pausedReason: PAUSED_REASON_INSUFFICIENT_FUNDS,
    },
    data: {
      status: "ACTIVE",
      pausedReason: null,
    },
  });
}

export async function reverseLeadPayment(
  leadId: string,
  _actorId: string,
  reason?: string,
  outerTx?: Prisma.TransactionClient,
) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { status: true, isTest: true },
  });

  if (lead.isTest) {
    throw Errors.validation("Test leads cannot be reversed.");
  }

  if (lead.status !== "PAID") {
    throw Errors.validation("Lead is not paid; nothing to reverse.");
  }

  if (outerTx) {
    return reverseLeadPaymentInTx(outerTx, leadId, reason);
  }

  return prisma.$transaction((tx) => reverseLeadPaymentInTx(tx, leadId, reason));
}

/** Backfill publisher wallet credit for PAID leads that were not credited (e.g. optin before fix). */
export async function reconcilePublisherLeadCredit(leadId: string): Promise<boolean> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        campaign: true,
        publisher: { select: { role: true } },
      },
    });
    if (!lead || lead.status !== "PAID" || !shouldCreditPublisherForLead(lead)) {
      return false;
    }

    const existing = await prisma.ledgerEntry.findFirst({
      where: {
        type: "CREDIT",
        referenceType: "lead",
        referenceId: leadId,
        wallet: { userId: lead.publisherId },
      },
    });
    if (existing) return false;

    const settings = await getPlatformSettings();
    const { publisherAmount } = calculatePublisherPayout(
      getLeadCpl(lead),
      lead.country,
      settings,
    );

    await prisma.$transaction(async (tx) => {
      await ensurePublisherWallet(lead.publisherId, tx);
      await creditWallet(
        tx,
        lead.publisherId,
        publisherAmount,
        "lead",
        leadId,
        `Earnings from lead`,
      );
    });

    return true;
  } catch (error) {
    console.error(`Failed to reconcile publisher credit for lead ${leadId}`, error);
    return false;
  }
}

export async function reconcileAllPublisherLeadCredits(): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { status: "PAID" },
    include: {
      campaign: { select: { advertiserId: true } },
      publisher: { select: { role: true } },
    },
  });

  let credited = 0;
  for (const lead of leads) {
    if (!shouldCreditPublisherForLead(lead)) continue;
    const didCredit = await reconcilePublisherLeadCredit(lead.id);
    if (didCredit) credited += 1;
  }
  return credited;
}

/** Backfill missing credits for one publisher's PAID leads (safe to call on dashboard load). */
export async function reconcilePublisherLeadCreditsForUser(publisherId: string): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: { publisherId, status: "PAID" },
    include: {
      campaign: { select: { advertiserId: true } },
      publisher: { select: { role: true } },
    },
  });

  let credited = 0;
  for (const lead of leads) {
    if (!shouldCreditPublisherForLead(lead)) continue;
    const didCredit = await reconcilePublisherLeadCredit(lead.id);
    if (didCredit) credited += 1;
  }
  return credited;
}

export async function getWalletBalance(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;

  return {
    balance: Number(wallet.balance),
    holdBalance: Number(wallet.holdBalance),
    availableBalance: Number(wallet.balance) - Number(wallet.holdBalance),
    currency: wallet.currency,
  };
}

export async function listPublisherLedger(
  userId: string,
  options: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 10));
  const skip = (page - 1) * limit;

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    return {
      data: [],
      meta: { total: 0, page, limit, totalPages: 1 },
      totalEarned: 0,
    };
  }

  const where = { walletId: wallet.id, type: "CREDIT" as const };

  const [entries, total, totalEarned] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ledgerEntry.count({ where }),
    prisma.ledgerEntry.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  return {
    data: entries.map((entry) => ({
      id: entry.id,
      amount: Number(entry.amount),
      balanceAfter: Number(entry.balanceAfter),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      description: entry.description,
      createdAt: entry.createdAt,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    totalEarned: Number(totalEarned._sum.amount ?? 0),
  };
}

export async function listUserDeposits(
  userId: string,
  options: { page?: number; limit?: number } = {},
) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 10));
  const skip = (page - 1) * limit;

  const where = { userId };

  const [deposits, total, totalRecharged] = await Promise.all([
    prisma.deposit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.deposit.count({ where }),
    prisma.deposit.aggregate({
      where: { ...where, status: "COMPLETED" },
      _sum: { amount: true },
    }),
  ]);

  const depositIds = deposits.map((deposit) => deposit.id);
  const ledgerEntries =
    depositIds.length > 0
      ? await prisma.ledgerEntry.findMany({
          where: {
            referenceType: "deposit",
            referenceId: { in: depositIds },
            type: "CREDIT",
          },
          select: { referenceId: true, balanceAfter: true },
        })
      : [];

  const balanceAfterByDeposit = new Map(
    ledgerEntries.map((entry) => [entry.referenceId, Number(entry.balanceAfter)]),
  );

  return {
    data: deposits.map((deposit) => ({
      id: deposit.id,
      amount: Number(deposit.amount),
      status: deposit.status,
      method: deposit.method,
      paymentId: deposit.stripePaymentId,
      wiseReference: deposit.wiseReference,
      rejectionReason: deposit.rejectionReason,
      createdAt: deposit.createdAt,
      balanceAfter: balanceAfterByDeposit.get(deposit.id) ?? null,
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    totalRecharged: Number(totalRecharged._sum.amount ?? 0),
  };
}

export async function createWiseDeposit(
  userId: string,
  amount: number,
  wiseReference: string,
  paymentDetails?: { payerName?: string; note?: string },
) {
  const details =
    paymentDetails?.payerName || paymentDetails?.note
      ? {
          ...(paymentDetails.payerName ? { payerName: paymentDetails.payerName } : {}),
          ...(paymentDetails.note ? { note: paymentDetails.note } : {}),
        }
      : undefined;

  const deposit = await prisma.deposit.create({
    data: {
      userId,
      amount,
      method: "WISE",
      status: "PENDING",
      wiseReference,
      paymentDetails: details,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  void (async () => {
    await notifyGeneric(deposit.user, {
      title: "Wise deposit submitted",
      message: `We received your Wise deposit request for $${amount.toFixed(2)}. Reference: ${wiseReference}. It will be reviewed shortly.`,
      actionPath: "/advertiser/wallet",
      notificationType: "deposit.pending",
    });
    await notifyAdminAlert({
      title: "Wise deposit pending approval",
      message: `${deposit.user.name} submitted a Wise deposit of $${amount.toFixed(2)} (ref: ${wiseReference}).`,
      actionPath: "/admin/deposits",
      metadata: { depositId: deposit.id },
    });
  })();

  return deposit;
}

export async function listPendingDeposits() {
  return prisma.deposit.findMany({
    where: { status: "PENDING", method: "WISE" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          advertiserProfile: {
            select: {
              company: true,
              industry: true,
              billingInfo: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAdminDepositStats() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [totalReceived, pendingCount, thisMonth] = await Promise.all([
    prisma.deposit.aggregate({
      _sum: { amount: true },
      where: { status: "COMPLETED" },
    }),
    prisma.deposit.count({ where: { status: "PENDING" } }),
    prisma.deposit.aggregate({
      _sum: { amount: true },
      where: {
        status: "COMPLETED",
        createdAt: { gte: monthStart },
      },
    }),
  ]);

  return {
    totalAmount: Number(totalReceived._sum.amount ?? 0),
    pendingCount,
    thisMonthAmount: Number(thisMonth._sum.amount ?? 0),
  };
}

const depositUserSelect = {
  id: true,
  name: true,
  email: true,
  advertiserProfile: {
    select: {
      company: true,
      industry: true,
      billingInfo: true,
    },
  },
} as const;

export async function listAdminDeposits(options: {
  advertiserId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.DepositWhereInput = {};

  if (options.advertiserId) {
    where.userId = options.advertiserId;
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

  const [deposits, total] = await Promise.all([
    prisma.deposit.findMany({
      where,
      include: { user: { select: depositUserSelect } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.deposit.count({ where }),
  ]);

  return {
    data: deposits,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listDepositAdvertiserOptions() {
  return prisma.user.findMany({
    where: { role: "ADVERTISER" },
    select: {
      id: true,
      name: true,
      email: true,
      advertiserProfile: { select: { company: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function approveDeposit(depositId: string, adminId: string) {
  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { id: depositId },
  });

  if (deposit.status !== "PENDING" || deposit.method !== "WISE") {
    throw new Error("Deposit is not pending Wise approval");
  }

  await prisma.$transaction(async (tx) => {
    await creditWallet(
      tx,
      deposit.userId,
      Number(deposit.amount),
      "deposit",
      depositId,
      "Wise deposit approved",
    );

    await reactivateCampaignsForFunds(tx, deposit.userId);

    await tx.deposit.update({
      where: { id: depositId },
      data: { status: "COMPLETED", processedAt: new Date() },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "deposit.approved",
        entityType: "deposit",
        entityId: depositId,
      },
    });
  });

  const updated = await prisma.deposit.findUniqueOrThrow({
    where: { id: depositId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  void notifyApproved(
    updated.user,
    "Wise deposit",
    `$${Number(updated.amount).toFixed(2)} has been credited to your wallet.`,
    "deposit.approved",
  );

  return updated;
}

export async function rejectDeposit(depositId: string, adminId: string, reason: string) {
  const deposit = await prisma.deposit.findUniqueOrThrow({
    where: { id: depositId },
  });

  if (deposit.status !== "PENDING" || deposit.method !== "WISE") {
    throw new Error("Deposit is not pending Wise approval");
  }

  await prisma.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: depositId },
      data: {
        status: "FAILED",
        rejectionReason: reason,
        processedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "deposit.rejected",
        entityType: "deposit",
        entityId: depositId,
        metadata: { reason },
      },
    });
  });

  const updated = await prisma.deposit.findUniqueOrThrow({
    where: { id: depositId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  void notifyRejected(updated.user, "Wise deposit", reason, undefined, "deposit.rejected");

  return updated;
}

export async function createManualDeposit(
  adminId: string,
  userId: string,
  amount: number,
  note: string,
) {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, name: true },
  });

  if (!user || user.role !== "ADVERTISER") {
    throw new Error("INVALID_USER");
  }

  const deposit = await prisma.$transaction(async (tx) => {
    const created = await tx.deposit.create({
      data: {
        userId,
        amount,
        method: "MANUAL",
        status: "COMPLETED",
        processedAt: new Date(),
        paymentDetails: note ? { note, recordedBy: adminId } : { recordedBy: adminId },
      },
    });

    await creditWallet(
      tx,
      userId,
      amount,
      "deposit",
      created.id,
      note || "Manual admin deposit",
    );

    await reactivateCampaignsForFunds(tx, userId);

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "deposit.manual",
        entityType: "deposit",
        entityId: created.id,
        metadata: { userId, amount, note },
      },
    });

    return created;
  });

  void notifyApproved(
    user,
    "Wallet deposit",
    `$${amount.toFixed(2)} has been credited to your wallet.${note ? ` Note: ${note}` : ""}`,
    "deposit.manual",
  );

  return deposit;
}
