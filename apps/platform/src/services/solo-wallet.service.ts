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
import { notifyUserById } from "@/services/notify.service";

/** Earnings-wallet ledger reference for money moved into the advertising wallet. */
export const SOLO_ADS_TRANSFER_REFERENCE = "solo_ads_transfer";
export const SOLO_DEPOSIT_PURPOSE = "solo_ads_deposit";

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
  if (amountCents > 5_000_000) throw Errors.validation("The maximum single deposit is $50,000.00", "amount");

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
  if (deposit.status !== "PENDING") return deposit;
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
