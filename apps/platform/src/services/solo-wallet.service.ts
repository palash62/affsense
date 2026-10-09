import type Stripe from "stripe";
import {
  ensureSoloWallet,
  formatCents,
  isUniqueViolation,
  loadSoloAdsConfig,
  postSoloLedgerEntry,
  resumeFundedSoloCampaigns,
  SoloInsufficientFundsError,
} from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { getResolvedStripeConfig } from "@/services/stripe-settings.service";
import { getStripeClient, resolveStripeCustomerId } from "@/services/stripe-payment.service";
import { ensurePublisherWallet } from "@/services/wallet.service";
import { notifyAdminAlert, notifyUserById } from "@/services/notify.service";

/** Earnings-wallet ledger reference for money moved into the advertising wallet. */
export const SOLO_ADS_TRANSFER_REFERENCE = "solo_ads_transfer";
export const SOLO_DEPOSIT_PURPOSE = "solo_ads_deposit";

const MAX_DEPOSIT_CENTS = 5_000_000;
const MAX_PENDING_WISE_DEPOSITS = 3;
const ADMIN_PAY_WISE_KEY = "admin_pay_wise";

async function resumeAfterFunding(publisherId: string) {
  try {
    await resumeFundedSoloCampaigns(publisherId);
  } catch (error) {
    console.error("[solo] resume after funding failed", error);
  }
}

export async function getSoloWalletSummary(publisherId: string) {
  const wallet = await ensureSoloWallet(publisherId);
  const [earnings, pendingDeposits] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId: publisherId }, select: { balance: true, holdBalance: true } }),
    prisma.soloDeposit.count({ where: { publisherId, status: "PENDING" } }),
  ]);
  const earningsAvailable = earnings
    ? Math.max(0, Math.floor((Number(earnings.balance) - Number(earnings.holdBalance)) * 100))
    : 0;
  return {
    walletId: wallet.id,
    balanceCents: wallet.balanceCents,
    reservedCents: wallet.reservedCents,
    availableCents: wallet.balanceCents - wallet.reservedCents,
    earningsAvailableCents: earningsAvailable,
    pendingDeposits,
  };
}

export async function listSoloLedger(
  publisherId: string,
  options: { page?: number; limit?: number; type?: string | null } = {},
) {
  const wallet = await ensureSoloWallet(publisherId);
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const where = {
    walletId: wallet.id,
    ...(options.type ? { type: options.type as never } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.soloWalletLedger.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.soloWalletLedger.count({ where }),
  ]);
  return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function listSoloDeposits(publisherId: string, take = 20) {
  return prisma.soloDeposit.findMany({
    where: { publisherId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Start a card deposit. The wallet is credited only once Stripe confirms the payment. */
export async function createSoloDepositIntent(publisherId: string, amountCents: number) {
  const config = await loadSoloAdsConfig();
  if (!Number.isInteger(amountCents) || amountCents < config.minDepositCents) {
    throw Errors.validation(`The minimum deposit is ${formatCents(config.minDepositCents)}`, "amount");
  }
  if (amountCents > MAX_DEPOSIT_CENTS) throw Errors.validation("The maximum single deposit is $50,000.00", "amount");

  const stripeConfig = await getResolvedStripeConfig();
  if (!stripeConfig.enabled || !stripeConfig.publishableKey) {
    throw new AppError("STRIPE_NOT_CONFIGURED", "Card payments are not available right now", 503);
  }
  const stripe = await getStripeClient();
  const wallet = await ensureSoloWallet(publisherId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: publisherId },
    select: { id: true, email: true, name: true, stripeCustomerId: true },
  });

  const deposit = await prisma.soloDeposit.create({
    data: { walletId: wallet.id, publisherId, amountCents, status: "PENDING" },
  });
  try {
    const customer = await resolveStripeCustomerId(stripe, user);
    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: "Affsense Solo Ads advertising funds",
        metadata: { purpose: SOLO_DEPOSIT_PURPOSE, soloDepositId: deposit.id, publisherId },
        ...(customer ? { customer, receipt_email: user.email } : {}),
      },
      { idempotencyKey: `solo-deposit-${deposit.id}` },
    );
    await prisma.soloDeposit.update({
      where: { id: deposit.id },
      data: { stripePaymentIntentId: intent.id },
    });
    if (!intent.client_secret) throw new Error("STRIPE_CLIENT_SECRET_MISSING");
    return {
      depositId: deposit.id,
      clientSecret: intent.client_secret,
      publishableKey: stripeConfig.publishableKey,
    };
  } catch (error) {
    await prisma.soloDeposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 500) : "error" },
    });
    throw error;
  }
}

/**
 * Credit a deposit after verifying the PaymentIntent with Stripe (server-side).
 * Called by the Stripe webhook and by the "refresh" endpoint; idempotent.
 */
export async function settleSoloDeposit(depositId: string, verifiedIntent?: Stripe.PaymentIntent) {
  const deposit = await prisma.soloDeposit.findUnique({ where: { id: depositId } });
  if (!deposit) throw Errors.notFound("Deposit");
  if (deposit.method !== "CARD" || deposit.status !== "PENDING") return deposit;
  if (!deposit.stripePaymentIntentId) return deposit;

  const intent =
    verifiedIntent ?? (await (await getStripeClient()).paymentIntents.retrieve(deposit.stripePaymentIntentId));
  if (intent.id !== deposit.stripePaymentIntentId) throw new AppError("DEPOSIT_MISMATCH", "Payment does not match", 422);

  if (intent.status === "canceled" || intent.status === "requires_payment_method") {
    if (intent.status === "canceled" || intent.last_payment_error) {
      return prisma.soloDeposit.update({
        where: { id: deposit.id },
        data: {
          status: "FAILED",
          failureReason: intent.last_payment_error?.message?.slice(0, 500) ?? intent.status,
        },
      });
    }
    return deposit;
  }
  if (intent.status !== "succeeded") return deposit;
  if (intent.amount_received !== deposit.amountCents || intent.currency !== "usd") {
    throw new AppError("DEPOSIT_AMOUNT_MISMATCH", "Payment amount does not match the deposit", 422);
  }

  const settled = await prisma.$transaction(async (tx) => {
    const flipped = await tx.soloDeposit.updateMany({
      where: { id: deposit.id, status: "PENDING" },
      data: { status: "SUCCEEDED", completedAt: new Date() },
    });
    if (flipped.count !== 1) return false;
    await postSoloLedgerEntry(tx, {
      walletId: deposit.walletId,
      type: "DEPOSIT",
      amountCents: deposit.amountCents,
      idempotencyKey: `deposit:${deposit.id}`,
      sourceType: "solo_deposit",
      sourceId: deposit.id,
      reason: "Card deposit",
    });
    return true;
  });

  if (settled) {
    await resumeAfterFunding(deposit.publisherId);
    void notifyUserById(deposit.publisherId, {
      title: "Advertising funds added",
      message: `${formatCents(deposit.amountCents)} was added to your Solo Ads wallet.`,
      actionPath: "/publisher/solo-ads/wallet",
      notificationType: "solo.deposit.succeeded",
    }).catch((error) => console.error("[solo] deposit notify failed", error));
  }
  return prisma.soloDeposit.findUniqueOrThrow({ where: { id: deposit.id } });
}

export async function refreshSoloDeposit(publisherId: string, depositId: string) {
  const deposit = await prisma.soloDeposit.findUnique({ where: { id: depositId } });
  if (!deposit || deposit.publisherId !== publisherId) throw Errors.notFound("Deposit");
  return settleSoloDeposit(depositId);
}

/** Admin's Wise ID/email from Admin Settings → Receive payment details. */
export async function getAdminWiseReceiveId(): Promise<string | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key: ADMIN_PAY_WISE_KEY } });
  return typeof row?.value === "string" && row.value.trim() ? row.value.trim() : null;
}

export async function getSoloFundingOptions() {
  const [config, stripe, wiseId] = await Promise.all([
    loadSoloAdsConfig(),
    getResolvedStripeConfig(),
    getAdminWiseReceiveId(),
  ]);
  return {
    card: Boolean(stripe.enabled && stripe.publishableKey),
    wise: wiseId ? { receiveId: wiseId } : null,
    transfer: config.transferEnabled,
    minDepositCents: config.minDepositCents,
    maxDepositCents: MAX_DEPOSIT_CENTS,
  };
}

/** Affiliate reports a Wise transfer to the admin; credited only after admin approval. */
export async function submitSoloWiseDeposit(input: {
  publisherId: string;
  amountCents: number;
  reference: string;
  note?: string | null;
}) {
  const wiseId = await getAdminWiseReceiveId();
  if (!wiseId) throw new AppError("WISE_NOT_CONFIGURED", "Wise payments are not available right now", 503);
  const config = await loadSoloAdsConfig();
  if (!Number.isInteger(input.amountCents) || input.amountCents < config.minDepositCents) {
    throw Errors.validation(`The minimum deposit is ${formatCents(config.minDepositCents)}`, "amount");
  }
  if (input.amountCents > MAX_DEPOSIT_CENTS) throw Errors.validation("The maximum single deposit is $50,000.00", "amount");
  const reference = input.reference.trim();
  if (reference.length < 3 || reference.length > 120) {
    throw Errors.validation("Enter the Wise transfer reference (3–120 characters)", "reference");
  }
  const note = input.note?.trim().slice(0, 1000) || null;

  const [pending, duplicate] = await Promise.all([
    prisma.soloDeposit.count({ where: { publisherId: input.publisherId, method: "WISE", status: "PENDING" } }),
    prisma.soloDeposit.findFirst({
      where: { method: "WISE", paymentReference: reference, status: { not: "REJECTED" } },
      select: { id: true },
    }),
  ]);
  if (pending >= MAX_PENDING_WISE_DEPOSITS) {
    throw new AppError(
      "TOO_MANY_PENDING_DEPOSITS",
      `You already have ${MAX_PENDING_WISE_DEPOSITS} Wise deposits waiting for review`,
      422,
    );
  }
  if (duplicate) throw new AppError("DUPLICATE_REFERENCE", "This Wise reference was already submitted", 409);

  const wallet = await ensureSoloWallet(input.publisherId);
  const deposit = await prisma.soloDeposit.create({
    data: {
      walletId: wallet.id,
      publisherId: input.publisherId,
      amountCents: input.amountCents,
      method: "WISE",
      paymentReference: reference,
      note,
      status: "PENDING",
    },
  });

  const publisher = await prisma.user.findUnique({ where: { id: input.publisherId }, select: { name: true, email: true } });
  void notifyAdminAlert({
    title: "Solo Ads Wise deposit to review",
    message: `${publisher?.name ?? publisher?.email ?? "An affiliate"} reported a ${formatCents(input.amountCents)} Wise payment (reference ${reference}).`,
    actionPath: "/admin/solo-ads/wallets",
    actionLabel: "Review deposit",
    metadata: { depositId: deposit.id },
  }).catch((error) => console.error("[solo] wise deposit admin alert failed", error));

  return deposit;
}

export async function listPendingSoloWiseDeposits(take = 100) {
  const rows = await prisma.soloDeposit.findMany({
    where: { method: "WISE", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take,
  });
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.publisherId))] } },
    select: { id: true, name: true, email: true, memberNo: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, publisher: byId.get(r.publisherId) ?? null }));
}

export async function countPendingSoloWiseDeposits() {
  return prisma.soloDeposit.count({ where: { method: "WISE", status: "PENDING" } });
}

async function loadWiseDepositForReview(depositId: string) {
  const deposit = await prisma.soloDeposit.findUnique({ where: { id: depositId } });
  if (!deposit || deposit.method !== "WISE") throw Errors.notFound("Deposit");
  return deposit;
}

/** Credit a reported Wise payment. Idempotent; `creditedCents` may be lower to absorb transfer fees. */
export async function approveSoloWiseDeposit(depositId: string, adminId: string, creditedCents?: number) {
  const deposit = await loadWiseDepositForReview(depositId);
  if (deposit.status === "SUCCEEDED") return deposit;
  if (deposit.status !== "PENDING") throw new AppError("DEPOSIT_NOT_PENDING", "This deposit was already reviewed", 409);
  const amount = creditedCents ?? deposit.amountCents;
  if (!Number.isInteger(amount) || amount < 1 || amount > deposit.amountCents) {
    throw Errors.validation(`Enter an amount between $0.01 and ${formatCents(deposit.amountCents)}`, "amount");
  }

  const now = new Date();
  const approved = await prisma.$transaction(async (tx) => {
    const flipped = await tx.soloDeposit.updateMany({
      where: { id: deposit.id, status: "PENDING" },
      data: { status: "SUCCEEDED", amountCents: amount, reviewedById: adminId, reviewedAt: now, completedAt: now },
    });
    if (flipped.count !== 1) return false;
    await postSoloLedgerEntry(tx, {
      walletId: deposit.walletId,
      type: "DEPOSIT",
      amountCents: amount,
      idempotencyKey: `deposit:${deposit.id}`,
      sourceType: "solo_deposit",
      sourceId: deposit.id,
      actorId: adminId,
      reason: `Wise deposit (ref ${deposit.paymentReference ?? "-"})`,
    });
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "solo.deposit.wise.approve",
        entityType: "solo_deposit",
        entityId: deposit.id,
        metadata: {
          publisherId: deposit.publisherId,
          requestedCents: deposit.amountCents,
          creditedCents: amount,
          reference: deposit.paymentReference,
        },
      },
    });
    return true;
  });

  if (approved) {
    await resumeAfterFunding(deposit.publisherId);
    const message =
      amount === deposit.amountCents
        ? `${formatCents(amount)} from your Wise payment was added to your Solo Ads wallet.`
        : `${formatCents(amount)} of your ${formatCents(deposit.amountCents)} Wise payment was added to your Solo Ads wallet (transfer fees deducted).`;
    void notifyUserById(deposit.publisherId, {
      title: "Wise deposit approved",
      message,
      actionPath: "/publisher/solo-ads/wallet",
      actionLabel: "View wallet",
      notificationType: "solo.deposit.succeeded",
    }).catch((error) => console.error("[solo] wise approve notify failed", error));
  }
  return prisma.soloDeposit.findUniqueOrThrow({ where: { id: deposit.id } });
}

export async function rejectSoloWiseDeposit(depositId: string, adminId: string, reason: string) {
  const text = reason.trim();
  if (text.length < 5) throw Errors.validation("Enter a reason of at least 5 characters", "reason");
  const deposit = await loadWiseDepositForReview(depositId);
  if (deposit.status !== "PENDING") throw new AppError("DEPOSIT_NOT_PENDING", "This deposit was already reviewed", 409);

  const now = new Date();
  const rejected = await prisma.$transaction(async (tx) => {
    const flipped = await tx.soloDeposit.updateMany({
      where: { id: deposit.id, status: "PENDING" },
      data: { status: "REJECTED", failureReason: text.slice(0, 500), reviewedById: adminId, reviewedAt: now },
    });
    if (flipped.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "solo.deposit.wise.reject",
        entityType: "solo_deposit",
        entityId: deposit.id,
        metadata: { publisherId: deposit.publisherId, amountCents: deposit.amountCents, reference: deposit.paymentReference, reason: text },
      },
    });
    return true;
  });
  if (!rejected) throw new AppError("DEPOSIT_NOT_PENDING", "This deposit was already reviewed", 409);

  void notifyUserById(deposit.publisherId, {
    title: "Wise deposit not approved",
    message: `Your ${formatCents(deposit.amountCents)} Wise deposit (reference ${deposit.paymentReference ?? "-"}) was not approved: ${text}`,
    actionPath: "/publisher/solo-ads/wallet",
    actionLabel: "View wallet",
    notificationType: "solo.deposit.rejected",
  }).catch((error) => console.error("[solo] wise reject notify failed", error));
  return prisma.soloDeposit.findUniqueOrThrow({ where: { id: deposit.id } });
}

/**
 * Card refund or dispute: take the money back out (balance may go negative).
 * For refunds `amountCents` is Stripe's cumulative refunded total.
 */
export async function reverseSoloDeposit(
  paymentIntentId: string,
  kind: "refund" | "chargeback",
  amountCents: number,
  externalId: string,
) {
  const deposit = await prisma.soloDeposit.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!deposit || deposit.status === "PENDING" || deposit.status === "FAILED") return null;
  const capped = Math.min(amountCents, deposit.amountCents);
  const amount = kind === "refund" ? capped - deposit.refundedCents : capped;
  if (amount <= 0) return null;

  try {
    await prisma.$transaction(async (tx) => {
      const entry = await postSoloLedgerEntry(tx, {
        walletId: deposit.walletId,
        type: kind === "refund" ? "REVERSAL" : "CHARGEBACK",
        amountCents: -amount,
        idempotencyKey: `${kind}:${externalId}`,
        sourceType: "solo_deposit",
        sourceId: deposit.id,
        reason: kind === "refund" ? "Card payment refunded" : "Card payment disputed",
      });
      if (!entry) return;
      await tx.soloDeposit.update({
        where: { id: deposit.id },
        data: {
          status: kind === "refund" ? "REFUNDED" : "DISPUTED",
          refundedCents: { increment: amount },
        },
      });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return deposit.id;
}

/**
 * Move available affiliate earnings into the advertising wallet. The earnings
 * debit stays in the invoice netting, so transferred money is never paid out.
 */
export async function transferEarningsToSoloWallet(publisherId: string, amountCents: number, requestKey: string) {
  const config = await loadSoloAdsConfig();
  if (!config.transferEnabled) throw new AppError("TRANSFER_DISABLED", "Transfers from earnings are disabled", 422);
  if (!Number.isInteger(amountCents) || amountCents < 100) {
    throw Errors.validation("Enter an amount of at least $1.00", "amount");
  }
  const key = requestKey.trim().slice(0, 80);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw Errors.validation("Invalid request key");

  await ensurePublisherWallet(publisherId);
  const soloWallet = await ensureSoloWallet(publisherId);
  const amount = amountCents / 100;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: string; balance: string; hold_balance: string }>>`
        SELECT id, balance, hold_balance FROM wallets WHERE user_id = ${publisherId} FOR UPDATE`;
      if (!locked) throw Errors.notFound("Wallet");
      const availableCents = Math.floor((Number(locked.balance) - Number(locked.hold_balance)) * 100);
      if (availableCents < amountCents) {
        throw new AppError("INSUFFICIENT_EARNINGS", "Your available earnings are lower than this amount", 422);
      }
      const newBalance = Math.round((Number(locked.balance) - amount) * 10_000) / 10_000;
      await tx.wallet.update({ where: { id: locked.id }, data: { balance: newBalance } });
      const debit = await tx.ledgerEntry.create({
        data: {
          walletId: locked.id,
          type: "DEBIT",
          amount,
          balanceAfter: newBalance,
          referenceType: SOLO_ADS_TRANSFER_REFERENCE,
          referenceId: key,
          description: "Transfer to Solo Ads wallet",
        },
      });
      const entry = await postSoloLedgerEntry(tx, {
        walletId: soloWallet.id,
        type: "EARNINGS_TRANSFER",
        amountCents,
        idempotencyKey: `transfer:${publisherId}:${key}`,
        sourceType: "earnings_ledger",
        sourceId: debit.id,
        actorId: publisherId,
        reason: "Transfer from affiliate earnings",
      });
      if (!entry) throw new AppError("DUPLICATE_TRANSFER", "This transfer was already submitted", 409);
      return entry;
    });
    await resumeAfterFunding(publisherId);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("DUPLICATE_TRANSFER", "This transfer was already submitted", 409);
    throw error;
  }
}

/** Admin credit/debit with a mandatory reason; audited. */
export async function adminAdjustSoloWallet(input: {
  adminId: string;
  publisherId: string;
  amountCents: number;
  reason: string;
  requestKey: string;
}) {
  const reason = input.reason.trim();
  if (reason.length < 5) throw Errors.validation("Enter a reason of at least 5 characters", "reason");
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    throw Errors.validation("Enter a non-zero amount", "amount");
  }
  const publisher = await prisma.user.findUnique({ where: { id: input.publisherId }, select: { role: true } });
  if (publisher?.role !== "PUBLISHER") throw Errors.notFound("Affiliate");
  const wallet = await ensureSoloWallet(input.publisherId);

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const row = await postSoloLedgerEntry(tx, {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: input.amountCents,
        idempotencyKey: `adjust:${input.requestKey.slice(0, 80)}`,
        sourceType: "admin",
        actorId: input.adminId,
        reason,
        requireAvailable: input.amountCents < 0,
      });
      if (!row) throw new AppError("DUPLICATE_ADJUSTMENT", "This adjustment was already applied", 409);
      await tx.auditLog.create({
        data: {
          actorId: input.adminId,
          action: "solo.wallet.adjust",
          entityType: "solo_wallet",
          entityId: wallet.id,
          metadata: { publisherId: input.publisherId, amountCents: input.amountCents, reason, ledgerId: row.id },
        },
      });
      return row;
    });
    if (input.amountCents > 0) await resumeAfterFunding(input.publisherId);
    return entry;
  } catch (error) {
    if (error instanceof SoloInsufficientFundsError) {
      throw new AppError("INSUFFICIENT_FUNDS", "The debit is larger than the spendable balance", 422);
    }
    throw error;
  }
}
