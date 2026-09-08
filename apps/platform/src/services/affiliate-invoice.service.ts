import { Prisma, type AffiliateInvoiceStatus, type PayoutMethod } from "@prisma/client";
import { addDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { invoiceWeekStart, resolveInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";
import {
  debitWalletForPayout,
  holdWalletFunds,
  releaseWalletHold,
} from "@/services/wallet.service";
import { notifyApproved, notifyUserById } from "@/services/notify.service";

/** Ledger reference types that represent money leaving the wallet, never earnings. */
const NON_EARNING_REFERENCE_TYPES = ["payout", "referral_payout"];

const SOURCE_LABELS: Record<string, string> = {
  lead: "CPL leads",
  lead_reversal: "CPL leads",
  offerwall_conversion: "Offer wall",
  referral: "Referrals",
  adjustment: "Adjustments",
  deposit: "Deposits",
};

/**
 * Existing `referenceType` values are inconsistently cased ("lead" vs
 * "OFFERWALL_CONVERSION"), so normalize before grouping.
 */
function sourceLabel(referenceType: string): string {
  const key = referenceType.trim().toLowerCase();
  return SOURCE_LABELS[key] ?? "Other earnings";
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  issuedAt: Date,
): Promise<string> {
  const year = issuedAt.getUTCFullYear();
  const prefix = `AFF-${year}-`;
  const used = await tx.affiliateInvoice.count({ where: { number: { startsWith: prefix } } });
  return `${prefix}${String(used + 1).padStart(5, "0")}`;
}

export type GenerateAffiliateInvoicesResult = {
  periodEnd: string;
  minimumAmount: number;
  created: number;
  skipped: number;
  failed: number;
  totalAmount: number;
  invoices: { id: string; number: string; publisherId: string; total: number }[];
  errors: { walletId: string; message: string }[];
};

/**
 * Raise invoices for every affiliate whose uninvoiced earnings, up to the end of
 * the last completed Monday-to-Sunday week, have reached the minimum.
 *
 * Safe to run repeatedly: billed entries carry an `invoiceId`, and the
 * `[publisherId, periodEnd]` unique constraint blocks a second invoice for the
 * same week. Affiliates under the minimum are left untouched so their earnings
 * roll into a later run.
 */
export async function generateAffiliateInvoices(
  runAt: Date = new Date(),
  adminId?: string,
): Promise<GenerateAffiliateInvoicesResult> {
  const config = await loadAffiliateInvoicingConfig();
  if (!config.enabled) {
    throw new AppError("INVOICING_DISABLED", "Affiliate invoicing is disabled", 422);
  }

  const { periodEnd, periodEndExclusive } = resolveInvoicePeriod(runAt, config.timezone);
  const startAt = config.startAt ? new Date(config.startAt) : null;

  const createdAtFilter: Prisma.DateTimeFilter = { lt: periodEndExclusive };
  if (startAt) createdAtFilter.gte = startAt;

  const candidateWhere: Prisma.LedgerEntryWhereInput = {
    invoiceId: null,
    createdAt: createdAtFilter,
    referenceType: { notIn: NON_EARNING_REFERENCE_TYPES },
    wallet: { user: { role: "PUBLISHER" } },
  };

  const candidates = await prisma.ledgerEntry.groupBy({
    by: ["walletId"],
    where: candidateWhere,
    _count: { _all: true },
  });

  const result: GenerateAffiliateInvoicesResult = {
    periodEnd: periodEnd.toISOString(),
    minimumAmount: config.minimumAmount,
    created: 0,
    skipped: 0,
    failed: 0,
    totalAmount: 0,
    invoices: [],
    errors: [],
  };

  for (const candidate of candidates) {
    // One affiliate failing must not stop the rest of the weekly run.
    try {
      const invoice = await createInvoiceForWallet(candidate.walletId, {
        createdAtFilter,
        periodEnd,
        minimumAmount: config.minimumAmount,
        netTermDays: config.netTermDays,
        timezone: config.timezone,
        issuedAt: runAt,
        adminId,
      });

      if (!invoice) {
        result.skipped += 1;
        continue;
      }

      result.created += 1;
      result.totalAmount = round4(result.totalAmount + invoice.total);
      result.invoices.push(invoice);
    } catch (error) {
      result.failed += 1;
      const message =
        error instanceof Error && error.message === "INSUFFICIENT_FUNDS"
          ? "Wallet balance is lower than the earnings to invoice"
          : error instanceof Error
            ? error.message
            : "Unknown error";
      result.errors.push({ walletId: candidate.walletId, message });
      console.error(`[affiliate-invoice] wallet ${candidate.walletId}: ${message}`);
    }
  }

  return result;
}

async function createInvoiceForWallet(
  walletId: string,
  options: {
    createdAtFilter: Prisma.DateTimeFilter;
    periodEnd: Date;
    minimumAmount: number;
    netTermDays: number;
    timezone: string;
    issuedAt: Date;
    adminId?: string;
  },
): Promise<{ id: string; number: string; publisherId: string; total: number } | null> {
  const created = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, userId: true, currency: true },
    });
    if (!wallet) return null;

    const entries = await tx.ledgerEntry.findMany({
      where: {
        walletId,
        invoiceId: null,
        createdAt: options.createdAtFilter,
        referenceType: { notIn: NON_EARNING_REFERENCE_TYPES },
      },
      select: {
        id: true,
        type: true,
        amount: true,
        referenceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (entries.length === 0) return null;

    const groups = new Map<string, { amount: number; entryCount: number }>();
    let total = 0;

    for (const entry of entries) {
      const signed = entry.type === "CREDIT" ? Number(entry.amount) : -Number(entry.amount);
      total += signed;
      const label = sourceLabel(entry.referenceType);
      const group = groups.get(label) ?? { amount: 0, entryCount: 0 };
      group.amount = round4(group.amount + signed);
      group.entryCount += 1;
      groups.set(label, group);
    }

    total = round4(total);
    if (total < options.minimumAmount || total <= 0) return null;

    const periodStart = invoiceWeekStart(entries[0].createdAt, options.timezone);
    const number = await nextInvoiceNumber(tx, options.issuedAt);

    const invoice = await tx.affiliateInvoice.create({
      data: {
        number,
        publisherId: wallet.userId,
        periodStart,
        periodEnd: options.periodEnd,
        periodKey: options.periodEnd.toISOString(),
        issuedAt: options.issuedAt,
        dueAt: addDays(options.issuedAt, options.netTermDays),
        subtotal: total,
        total,
        currency: wallet.currency,
        lines: {
          create: [...groups.entries()].map(([source, group]) => ({
            source,
            entryCount: group.entryCount,
            amount: group.amount,
          })),
        },
      },
      select: { id: true, number: true, total: true },
    });

    // Claim the entries. The `invoiceId: null` guard means a concurrent run
    // cannot bill the same earning twice.
    const claimed = await tx.ledgerEntry.updateMany({
      where: { id: { in: entries.map((entry) => entry.id) }, invoiceId: null },
      data: { invoiceId: invoice.id },
    });
    if (claimed.count !== entries.length) {
      throw new AppError(
        "INVOICE_CLAIM_CONFLICT",
        "Earnings changed while the invoice was being generated",
        409,
      );
    }

    // Reserve the balance so it cannot be spent while the invoice is outstanding.
    await holdWalletFunds(tx, wallet.userId, total);

    await tx.auditLog.create({
      data: {
        actorId: options.adminId ?? wallet.userId,
        action: "affiliate_invoice.generated",
        entityType: "affiliate_invoice",
        entityId: invoice.id,
        metadata: {
          number: invoice.number,
          publisherId: wallet.userId,
          total,
          entryCount: entries.length,
          periodStart: periodStart.toISOString(),
          periodEnd: options.periodEnd.toISOString(),
        },
      },
    });

    return { ...invoice, publisherId: wallet.userId };
  });

  if (!created) return null;

  void notifyUserById(created.publisherId, {
    title: "New invoice available",
    message: `Invoice ${created.number} for $${round2(Number(created.total)).toFixed(2)} is ready and awaiting payment.`,
    actionPath: "/publisher/invoices",
    actionLabel: "View invoice",
    notificationType: "affiliate_invoice.generated",
  });

  return {
    id: created.id,
    number: created.number,
    publisherId: created.publisherId,
    total: Number(created.total),
  };
}

export async function payAffiliateInvoice(
  invoiceId: string,
  input: { method: PayoutMethod; reference?: string; note?: string },
  adminId: string,
) {
  const invoice = await prisma.affiliateInvoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      number: true,
      publisherId: true,
      status: true,
      total: true,
    },
  });
  if (!invoice) throw Errors.notFound("Invoice");
  if (invoice.status !== "UNPAID") {
    throw Errors.validation(`Invoice is already ${invoice.status.toLowerCase()}`);
  }

  const total = Number(invoice.total);
  const reference = input.reference?.trim() || null;
  const note = input.note?.trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      await debitWalletForPayout(
        tx,
        invoice.publisherId,
        total,
        invoice.id,
        `Invoice ${invoice.number} paid`,
      );

      // Stamp the payout debit with the invoice so a later generation run can
      // never mistake it for uninvoiced earnings.
      await tx.ledgerEntry.updateMany({
        where: { referenceType: "payout", referenceId: invoice.id, invoiceId: null },
        data: { invoiceId: invoice.id },
      });

      const payout = await tx.payout.create({
        data: {
          publisherId: invoice.publisherId,
          kind: "PUBLISHER",
          amount: total,
          method: input.method,
          status: "COMPLETED",
          processedAt: new Date(),
          idempotencyKey: `invoice:${invoice.id}`,
          paymentDetails: reference ? { invoiceReference: reference } : undefined,
        },
        select: { id: true },
      });

      await tx.affiliateInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: input.method,
          paymentReference: reference,
          adminNote: note,
          payoutId: payout.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: "affiliate_invoice.paid",
          entityType: "affiliate_invoice",
          entityId: invoice.id,
          metadata: {
            number: invoice.number,
            total,
            method: input.method,
            reference,
            payoutId: payout.id,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") {
      throw new AppError(
        "WALLET_INSUFFICIENT_FUNDS",
        "The affiliate wallet no longer holds the invoiced amount. Review recent wallet adjustments before paying.",
        422,
      );
    }
    throw error;
  }

  const updated = await prisma.affiliateInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { publisher: { select: { id: true, name: true, email: true } } },
  });

  void notifyApproved(
    updated.publisher,
    `Invoice ${updated.number}`,
    `$${round2(Number(updated.total)).toFixed(2)} has been paid to your payment method.`,
    "affiliate_invoice.paid",
  );

  return updated;
}

export async function cancelAffiliateInvoice(
  invoiceId: string,
  reason: string,
  adminId: string,
) {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw Errors.validation("Cancellation reason is required");

  const invoice = await prisma.affiliateInvoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, number: true, publisherId: true, status: true, total: true },
  });
  if (!invoice) throw Errors.notFound("Invoice");
  if (invoice.status !== "UNPAID") {
    throw Errors.validation(`Invoice is already ${invoice.status.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    // Release the claim so these earnings return to the pool and get invoiced again.
    await tx.ledgerEntry.updateMany({
      where: { invoiceId: invoice.id },
      data: { invoiceId: null },
    });

    await releaseWalletHold(tx, invoice.publisherId, Number(invoice.total));

    await tx.affiliateInvoice.update({
      where: { id: invoice.id },
      // Clearing periodKey frees the period so those earnings can be re-invoiced.
      data: { status: "CANCELLED", cancelReason: trimmedReason, periodKey: null },
    });

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "affiliate_invoice.cancelled",
        entityType: "affiliate_invoice",
        entityId: invoice.id,
        metadata: { number: invoice.number, reason: trimmedReason },
      },
    });
  });

  return prisma.affiliateInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
}

export type SerializedAffiliateInvoice = {
  id: string;
  number: string;
  publisherId: string;
  publisherName: string;
  publisherEmail: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  total: number;
  currency: string;
  status: AffiliateInvoiceStatus;
  overdue: boolean;
  paidAt: string | null;
  paymentMethod: PayoutMethod | null;
  paymentReference: string | null;
  adminNote: string | null;
  cancelReason: string | null;
  lines: { id: string; source: string; entryCount: number; amount: number }[];
};

const invoiceInclude = {
  publisher: { select: { id: true, name: true, email: true } },
  lines: { orderBy: { amount: "desc" } },
} satisfies Prisma.AffiliateInvoiceInclude;

type InvoiceWithRelations = Prisma.AffiliateInvoiceGetPayload<{ include: typeof invoiceInclude }>;

function serializeInvoice(
  invoice: InvoiceWithRelations,
  now: Date,
): SerializedAffiliateInvoice {
  return {
    id: invoice.id,
    number: invoice.number,
    publisherId: invoice.publisherId,
    publisherName: invoice.publisher.name,
    publisherEmail: invoice.publisher.email,
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    issuedAt: invoice.issuedAt.toISOString(),
    dueAt: invoice.dueAt.toISOString(),
    total: Number(invoice.total),
    currency: invoice.currency,
    status: invoice.status,
    overdue: invoice.status === "UNPAID" && invoice.dueAt.getTime() < now.getTime(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    paymentMethod: invoice.paymentMethod,
    paymentReference: invoice.paymentReference,
    adminNote: invoice.adminNote,
    cancelReason: invoice.cancelReason,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      source: line.source,
      entryCount: line.entryCount,
      amount: Number(line.amount),
    })),
  };
}

export type AffiliateInvoiceListParams = {
  status?: AffiliateInvoiceStatus | "OVERDUE";
  publisherId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

function buildInvoiceWhere(
  params: AffiliateInvoiceListParams,
  now: Date,
): Prisma.AffiliateInvoiceWhereInput {
  const where: Prisma.AffiliateInvoiceWhereInput = {};

  if (params.status === "OVERDUE") {
    where.status = "UNPAID";
    where.dueAt = { lt: now };
  } else if (params.status) {
    where.status = params.status;
  }

  if (params.publisherId) where.publisherId = params.publisherId;

  if (params.from || params.to) {
    const issuedAt: Prisma.DateTimeFilter = {};
    if (params.from) issuedAt.gte = new Date(params.from);
    if (params.to) {
      const to = new Date(params.to);
      to.setHours(23, 59, 59, 999);
      issuedAt.lte = to;
    }
    where.issuedAt = issuedAt;
  }

  return where;
}

export async function listAffiliateInvoicesForAdmin(params: AffiliateInvoiceListParams) {
  const now = new Date();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const where = buildInvoiceWhere(params, now);

  const [rows, total] = await Promise.all([
    prisma.affiliateInvoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateInvoice.count({ where }),
  ]);

  return {
    invoices: rows.map((row) => serializeInvoice(row, now)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getAffiliateInvoiceStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [unpaid, overdue, paidThisMonth] = await Promise.all([
    prisma.affiliateInvoice.aggregate({
      where: { status: "UNPAID" },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.affiliateInvoice.aggregate({
      where: { status: "UNPAID", dueAt: { lt: now } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.affiliateInvoice.aggregate({
      where: { status: "PAID", paidAt: { gte: monthStart } },
      _sum: { total: true },
      _count: { _all: true },
    }),
  ]);

  return {
    unpaidAmount: Number(unpaid._sum.total ?? 0),
    unpaidCount: unpaid._count._all,
    overdueAmount: Number(overdue._sum.total ?? 0),
    overdueCount: overdue._count._all,
    paidThisMonthAmount: Number(paidThisMonth._sum.total ?? 0),
    paidThisMonthCount: paidThisMonth._count._all,
  };
}

export async function listInvoicePublisherOptions() {
  const rows = await prisma.affiliateInvoice.findMany({
    distinct: ["publisherId"],
    select: { publisher: { select: { id: true, name: true, email: true } } },
    orderBy: { issuedAt: "desc" },
    take: 200,
  });
  return rows.map((row) => row.publisher);
}

export async function listAffiliateInvoicesForPublisher(
  publisherId: string,
  params: { page?: number; limit?: number } = {},
) {
  const now = new Date();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));

  const [rows, total] = await Promise.all([
    prisma.affiliateInvoice.findMany({
      where: { publisherId, status: { not: "CANCELLED" } },
      include: invoiceInclude,
      orderBy: { issuedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.affiliateInvoice.count({
      where: { publisherId, status: { not: "CANCELLED" } },
    }),
  ]);

  return {
    invoices: rows.map((row) => serializeInvoice(row, now)),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

/** What the affiliate has earned since their last invoice, for the pending line. */
export async function getUninvoicedTotalForPublisher(publisherId: string): Promise<number> {
  const config = await loadAffiliateInvoicingConfig();
  const wallet = await prisma.wallet.findUnique({
    where: { userId: publisherId },
    select: { id: true },
  });
  if (!wallet) return 0;

  const createdAtFilter: Prisma.DateTimeFilter = {};
  if (config.startAt) createdAtFilter.gte = new Date(config.startAt);

  const grouped = await prisma.ledgerEntry.groupBy({
    by: ["type"],
    where: {
      walletId: wallet.id,
      invoiceId: null,
      referenceType: { notIn: NON_EARNING_REFERENCE_TYPES },
      ...(config.startAt ? { createdAt: createdAtFilter } : {}),
    },
    _sum: { amount: true },
  });

  const total = grouped.reduce((sum, row) => {
    const amount = Number(row._sum.amount ?? 0);
    return row.type === "CREDIT" ? sum + amount : sum - amount;
  }, 0);

  return round4(Math.max(0, total));
}
