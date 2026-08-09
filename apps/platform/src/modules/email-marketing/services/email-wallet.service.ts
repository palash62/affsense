import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { debitWallet } from "@/services/wallet.service";
import { getEmailMarketingPlatformConfig } from "./email-marketing-config.service";

const SEND_REF = "email_send";
const TOPUP_REF = "email_wallet_topup";

export function emailCostUsd(emailsPerDollar: number): number {
  if (!Number.isFinite(emailsPerDollar) || emailsPerDollar <= 0) {
    throw new Error("INVALID_EMAILS_PER_DOLLAR");
  }
  // Keep 4 decimal places to match EmailWallet.balance precision.
  return Math.round((1 / emailsPerDollar) * 10_000) / 10_000;
}

export function emailsRemaining(balance: number, emailsPerDollar: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  if (!Number.isFinite(emailsPerDollar) || emailsPerDollar <= 0) return 0;
  return Math.floor(balance * emailsPerDollar + 1e-9);
}

export async function ensureEmailWallet(
  tx: Prisma.TransactionClient | typeof prisma,
  advertiserId: string,
) {
  const existing = await tx.emailWallet.findUnique({ where: { advertiserId } });
  if (existing) return existing;
  return tx.emailWallet.create({
    data: { advertiserId, balance: 0, currency: "USD" },
  });
}

export type EmailWalletSnapshot = {
  balance: number;
  emailsRemaining: number;
  emailsPerDollar: number;
  emailCostUsd: number;
  currency: string;
  mainAvailableBalance: number;
};

export async function getEmailWalletSnapshot(
  advertiserId: string,
): Promise<EmailWalletSnapshot> {
  const [wallet, config, main] = await Promise.all([
    ensureEmailWallet(prisma, advertiserId),
    getEmailMarketingPlatformConfig(),
    prisma.wallet.findUnique({ where: { userId: advertiserId } }),
  ]);

  const balance = Number(wallet.balance);
  const mainBalance = main ? Number(main.balance) : 0;
  const mainHold = main ? Number(main.holdBalance) : 0;

  return {
    balance,
    emailsRemaining: emailsRemaining(balance, config.emailsPerDollar),
    emailsPerDollar: config.emailsPerDollar,
    emailCostUsd: emailCostUsd(config.emailsPerDollar),
    currency: wallet.currency,
    mainAvailableBalance: Math.max(0, mainBalance - mainHold),
  };
}

export async function topUpFromMainWallet(advertiserId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Errors.validation("Enter an amount greater than zero", "amount");
  }

  const rounded = Math.round(amount * 100) / 100;
  if (rounded <= 0) {
    throw Errors.validation("Enter an amount greater than zero", "amount");
  }

  try {
    await prisma.$transaction(async (tx) => {
      const main = await tx.wallet.findUnique({ where: { userId: advertiserId } });
      if (!main) {
        throw Errors.insufficientFunds();
      }
      const available = Number(main.balance) - Number(main.holdBalance);
      if (available < rounded) {
        throw Errors.insufficientFunds();
      }

      const topUpId = randomUUID();
      await debitWallet(
        tx,
        advertiserId,
        rounded,
        TOPUP_REF,
        topUpId,
        `Autoresponder wallet top-up $${rounded.toFixed(2)}`,
      );

      const emailWallet = await ensureEmailWallet(tx, advertiserId);
      const newBalance = Number(emailWallet.balance) + rounded;

      await tx.emailWallet.update({
        where: { id: emailWallet.id },
        data: { balance: newBalance },
      });

      await tx.emailWalletLedger.create({
        data: {
          walletId: emailWallet.id,
          type: "CREDIT",
          amount: rounded,
          balanceAfter: newBalance,
          referenceType: TOPUP_REF,
          referenceId: topUpId,
          description: `Top-up from main wallet $${rounded.toFixed(2)}`,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") {
      throw Errors.insufficientFunds();
    }
    throw error;
  }

  return getEmailWalletSnapshot(advertiserId);
}

export async function hasEmailSendFunds(
  advertiserId: string,
  emailsPerDollar?: number,
): Promise<{ ok: boolean; cost: number; balance: number }> {
  const rate =
    emailsPerDollar ?? (await getEmailMarketingPlatformConfig()).emailsPerDollar;
  const cost = emailCostUsd(rate);
  const wallet = await ensureEmailWallet(prisma, advertiserId);
  const balance = Number(wallet.balance);
  return { ok: balance + 1e-9 >= cost, cost, balance };
}

/**
 * Debit one email cost after a successful send. Idempotent by EmailSend id.
 */
export async function debitForSend(advertiserId: string, sendId: string) {
  const config = await getEmailMarketingPlatformConfig();
  const cost = emailCostUsd(config.emailsPerDollar);

  try {
    await prisma.$transaction(async (tx) => {
      const already = await tx.emailWalletLedger.findFirst({
        where: {
          referenceType: SEND_REF,
          referenceId: sendId,
          type: "DEBIT",
        },
        select: { id: true },
      });
      if (already) return;

      const wallet = await ensureEmailWallet(tx, advertiserId);
      const balance = Number(wallet.balance);
      if (balance + 1e-9 < cost) {
        throw new Error("INSUFFICIENT_FUNDS");
      }

      const newBalance = Math.round((balance - cost) * 10_000) / 10_000;
      await tx.emailWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.emailWalletLedger.create({
        data: {
          walletId: wallet.id,
          type: "DEBIT",
          amount: cost,
          balanceAfter: newBalance,
          referenceType: SEND_REF,
          referenceId: sendId,
          description: "Marketing email send",
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FUNDS") {
      throw Errors.insufficientFunds();
    }
    throw error;
  }

  return { cost };
}
