import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import type { PayoutPaymentDetails } from "@/lib/payout-payment-details";
import type { Prisma, PayoutMethod } from "@prisma/client";
import { getPlatformSettings } from "@/services/wallet.service";
import {
  notifyAdminAlert,
} from "@/services/notify.service";

export const CPA_EARNING_HOLD_DAYS = 7;

export type CpaWalletActivityRow = {
  id: string;
  activity: "Earnings" | "Withdrawal";
  type: "CPA";
  details: string;
  amount: number;
  date: string;
  status: "pending" | "available" | "processing" | "completed" | "rejected" | "failed";
  availableInDays?: number;
  availableAt?: string;
};

export type CpaWalletSummary = {
  balance: number;
  holdBalance: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
};

export type CpaWalletPeriodTotals = {
  earnings: number;
  withdrawals: number;
};

function decimalToNumber(value: { toString(): string } | number | null | undefined) {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export async function ensureCpaWallet(
  advertiserId: string,
  tx?: Prisma.TransactionClient,
) {
  const db = tx ?? prisma;
  return db.cpaWallet.upsert({
    where: { advertiserId },
    create: { advertiserId },
    update: {},
  });
}

export async function creditCpaWallet(
  tx: Prisma.TransactionClient,
  advertiserId: string,
  amount: number,
) {
  const wallet = await ensureCpaWallet(advertiserId, tx);
  const newBalance = decimalToNumber(wallet.balance) + amount;
  await tx.cpaWallet.update({
    where: { id: wallet.id },
    data: { balance: newBalance },
  });
  return newBalance;
}

export async function holdCpaWalletFunds(
  tx: Prisma.TransactionClient,
  advertiserId: string,
  amount: number,
) {
  const wallet = await tx.cpaWallet.findUniqueOrThrow({ where: { advertiserId } });
  const available = decimalToNumber(wallet.balance) - decimalToNumber(wallet.holdBalance);
  if (available < amount) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  await tx.cpaWallet.update({
    where: { id: wallet.id },
    data: { holdBalance: decimalToNumber(wallet.holdBalance) + amount },
  });
}

export async function releaseCpaWalletHold(
  tx: Prisma.TransactionClient,
  advertiserId: string,
  amount: number,
) {
  const wallet = await tx.cpaWallet.findUniqueOrThrow({ where: { advertiserId } });
  await tx.cpaWallet.update({
    where: { id: wallet.id },
    data: {
      holdBalance: Math.max(0, decimalToNumber(wallet.holdBalance) - amount),
    },
  });
}

export async function debitCpaWalletForPayout(
  tx: Prisma.TransactionClient,
  advertiserId: string,
  amount: number,
) {
  const wallet = await tx.cpaWallet.findUniqueOrThrow({ where: { advertiserId } });
  const balance = decimalToNumber(wallet.balance);
  const hold = decimalToNumber(wallet.holdBalance);

  if (balance < amount || hold < amount) {
    throw new Error("INSUFFICIENT_FUNDS");
  }

  await tx.cpaWallet.update({
    where: { id: wallet.id },
    data: {
      balance: balance - amount,
      holdBalance: hold - amount,
    },
  });
}

export async function releaseMaturedCpaEarnings(advertiserId?: string) {
  const now = new Date();
  const where: Prisma.CpaEarningWhereInput = {
    status: "PENDING",
    availableAt: { lte: now },
  };
  if (advertiserId) {
    where.advertiserId = advertiserId;
  }

  const matured = await prisma.cpaEarning.findMany({
    where,
    select: { id: true, advertiserId: true, amount: true },
    orderBy: { availableAt: "asc" },
    take: 200,
  });

  if (matured.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const earning of matured) {
      const updated = await tx.cpaEarning.updateMany({
        where: { id: earning.id, status: "PENDING" },
        data: { status: "AVAILABLE" },
      });
      if (updated.count === 0) continue;
      await creditCpaWallet(tx, earning.advertiserId, decimalToNumber(earning.amount));
    }
  });

  return matured.length;
}

export async function getCpaWalletBalances(advertiserId: string): Promise<CpaWalletSummary> {
  await releaseMaturedCpaEarnings(advertiserId);

  const [wallet, pendingAgg] = await Promise.all([
    ensureCpaWallet(advertiserId),
    prisma.cpaEarning.aggregate({
      where: { advertiserId, status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  const balance = decimalToNumber(wallet.balance);
  const holdBalance = decimalToNumber(wallet.holdBalance);
  const pendingBalance = decimalToNumber(pendingAgg._sum.amount);

  return {
    balance,
    holdBalance,
    availableBalance: balance - holdBalance,
    pendingBalance,
    currency: wallet.currency,
  };
}

function daysUntil(date: Date) {
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

function payoutActivityStatus(status: string): CpaWalletActivityRow["status"] {
  switch (status) {
    case "PENDING":
    case "PROCESSING":
      return "processing";
    case "COMPLETED":
      return "completed";
    case "REJECTED":
      return "rejected";
    case "FAILED":
      return "failed";
    default:
      return "processing";
  }
}

export async function listCpaWalletActivity(
  advertiserId: string,
  options?: { limit?: number },
) {
  await releaseMaturedCpaEarnings(advertiserId);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));

  const [earnings, payouts] = await Promise.all([
    prisma.cpaEarning.findMany({
      where: { advertiserId },
      include: { offer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    prisma.payout.findMany({
      where: { publisherId: advertiserId, kind: "CPA" },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  ]);

  const rows: CpaWalletActivityRow[] = [
    ...earnings.map((row) => ({
      id: row.id,
      activity: "Earnings" as const,
      type: "CPA" as const,
      details: row.offer.name,
      amount: decimalToNumber(row.amount),
      date: row.createdAt.toISOString(),
      status:
        row.status === "PENDING"
          ? ("pending" as const)
          : ("available" as const),
      availableInDays:
        row.status === "PENDING" ? daysUntil(row.availableAt) : undefined,
      availableAt: row.availableAt.toISOString(),
    })),
    ...payouts.map((row) => ({
      id: row.id,
      activity: "Withdrawal" as const,
      type: "CPA" as const,
      details: "Withdrawal request",
      amount: -decimalToNumber(row.amount),
      date: row.createdAt.toISOString(),
      status: payoutActivityStatus(row.status),
    })),
  ];

  rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return rows.slice(0, limit);
}

export async function getCpaWalletPeriodTotals(
  advertiserId: string,
  days: 7 | 30,
): Promise<CpaWalletPeriodTotals> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [earningsAgg, withdrawalsAgg] = await Promise.all([
    prisma.cpaEarning.aggregate({
      where: { advertiserId, createdAt: { gte: since } },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: {
        publisherId: advertiserId,
        kind: "CPA",
        status: "COMPLETED",
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    earnings: decimalToNumber(earningsAgg._sum.amount),
    withdrawals: decimalToNumber(withdrawalsAgg._sum.amount),
  };
}

export async function getCpaWalletSnapshot(advertiserId: string) {
  const [balances, activity, summary7d, summary30d] = await Promise.all([
    getCpaWalletBalances(advertiserId),
    listCpaWalletActivity(advertiserId),
    getCpaWalletPeriodTotals(advertiserId, 7),
    getCpaWalletPeriodTotals(advertiserId, 30),
  ]);

  return {
    balances,
    activity,
    summary: {
      last7d: summary7d,
      last30d: summary30d,
    },
  };
}

export async function requestCpaPayout(
  advertiserId: string,
  amount: number,
  method: PayoutMethod,
  paymentDetails: PayoutPaymentDetails,
  idempotencyKey?: string,
) {
  const settings = await getPlatformSettings();
  const minAmount = settings.minAdvertiserWithdrawAmount;

  if (amount < minAmount) {
    throw Errors.payoutBelowMinimum(minAmount);
  }

  if (idempotencyKey) {
    const existing = await prisma.payout.findUnique({
      where: { idempotencyKey },
    });
    if (existing) throw Errors.duplicatePayout();
  }

  const user = await prisma.user.findUnique({
    where: { id: advertiserId },
    select: { role: true, name: true },
  });

  if (user?.role !== "ADVERTISER") {
    throw Errors.forbidden();
  }

  const balances = await getCpaWalletBalances(advertiserId);
  if (amount > balances.availableBalance) {
    throw Errors.insufficientFunds();
  }

  await ensureCpaWallet(advertiserId);

  const payout = await prisma.$transaction(async (tx) => {
    await holdCpaWalletFunds(tx, advertiserId, amount);

    return tx.payout.create({
      data: {
        publisherId: advertiserId,
        kind: "CPA",
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
    title: "New CPA wallet payout request",
    message: `${payout.publisher.name} requested CPA ${method} payout of $${amount.toFixed(2)}.`,
    actionPath: "/admin/cpa-offers/payouts",
    metadata: { payoutId: payout.id },
  });

  return payout;
}

export async function createCpaEarningForConversion(input: {
  conversionId: string;
  offerId: string;
  advertiserId: string;
  amount: number;
}) {
  if (input.amount <= 0) return null;

  const availableAt = new Date();
  availableAt.setDate(availableAt.getDate() + CPA_EARNING_HOLD_DAYS);

  return prisma.$transaction(async (tx) => {
    await ensureCpaWallet(input.advertiserId, tx);

    const existing = await tx.cpaEarning.findUnique({
      where: { conversionId: input.conversionId },
      select: { id: true },
    });
    if (existing) return existing;

    return tx.cpaEarning.create({
      data: {
        advertiserId: input.advertiserId,
        conversionId: input.conversionId,
        offerId: input.offerId,
        amount: input.amount,
        availableAt,
        status: "PENDING",
      },
    });
  });
}
