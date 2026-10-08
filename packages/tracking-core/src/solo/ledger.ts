import type { SoloLedgerType } from "@prisma/client";
import type { SoloTx } from "./store";

export class SoloInsufficientFundsError extends Error {
  constructor() {
    super("SOLO_INSUFFICIENT_FUNDS");
    this.name = "SoloInsufficientFundsError";
  }
}

/**
 * Append one ledger row and move the wallet balance in the same transaction.
 * Idempotent: returns null when `idempotencyKey` was already posted.
 * With `requireAvailable`, a debit fails unless balance - reserved covers it.
 */
export async function postSoloLedgerEntry(
  tx: SoloTx,
  input: {
    walletId: string;
    type: SoloLedgerType;
    amountCents: number;
    idempotencyKey: string;
    sourceType?: string | null;
    sourceId?: string | null;
    actorId?: string | null;
    reason?: string | null;
    requireAvailable?: boolean;
    /** Also release this much of the wallet's reservation (click charges). */
    releaseReservedCents?: number;
  },
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) {
    throw new Error("Ledger amount must be a non-zero integer number of cents");
  }
  const existing = await tx.soloWalletLedger.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { id: true },
  });
  if (existing) return null;

  const release = input.releaseReservedCents ?? 0;
  const affected = input.requireAvailable && input.amountCents < 0
    ? await tx.$executeRaw`
        UPDATE solo_wallets
        SET balance_cents = balance_cents + ${input.amountCents},
            reserved_cents = reserved_cents - ${release},
            version = version + 1
        WHERE id = ${input.walletId}
          AND balance_cents - reserved_cents + ${input.amountCents} >= 0`
    : await tx.$executeRaw`
        UPDATE solo_wallets
        SET balance_cents = balance_cents + ${input.amountCents},
            reserved_cents = GREATEST(reserved_cents - ${release}, 0),
            version = version + 1
        WHERE id = ${input.walletId}`;
  if (affected !== 1) throw new SoloInsufficientFundsError();

  const wallet = await tx.soloWallet.findUniqueOrThrow({
    where: { id: input.walletId },
    select: { balanceCents: true },
  });
  return tx.soloWalletLedger.create({
    data: {
      walletId: input.walletId,
      type: input.type,
      amountCents: input.amountCents,
      balanceAfterCents: wallet.balanceCents,
      idempotencyKey: input.idempotencyKey,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
    },
  });
}
