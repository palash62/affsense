import { reverseSoloConversionForWebhookEvent } from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { extractClickFunnelsIdentifiers } from "@/lib/clickfunnels-webhook-payload";
import {
  DIGITAL_PRODUCT_REFUND_REFERENCE,
  reverseDigitalProductSaleCommissions,
} from "@/services/wallet.service";

export const ADMIN_REJECT_MESSAGE_PREFIX = "Rejected by admin: ";

export type RejectDigitalProductConversionResult = {
  rejectedEventIds: string[];
  reversedAmount: number;
};

/**
 * Admin rejects an approved digital product sale: every approved copy of the same
 * order for that affiliate is marked REJECTED and its commission is debited back.
 */
export async function rejectDigitalProductConversion(
  eventId: string,
  adminId: string,
  reason: string,
): Promise<RejectDigitalProductConversionResult> {
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) {
    throw Errors.validation("Rejection reason is required", "reason");
  }

  const event = await prisma.webhookEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      status: true,
      publisherId: true,
      digitalProductId: true,
      cfOrderId: true,
      cfProductId: true,
      payloadJson: true,
    },
  });
  if (!event) throw Errors.notFound("Conversion");
  if (event.status !== "PROCESSED" || !event.publisherId) {
    throw new AppError("INVALID_STATE", "Only approved conversions can be rejected", 409);
  }
  if (extractClickFunnelsIdentifiers(event.payloadJson).isRefund) {
    throw new AppError("INVALID_STATE", "Refund events cannot be rejected", 409);
  }
  const publisherId = event.publisherId;

  const result = await prisma.$transaction(async (tx) => {
    // Same lock as commission posting, so a concurrent post cannot slip in between.
    await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${publisherId} FOR UPDATE`;

    const sameOrder = event.cfOrderId
      ? await tx.webhookEvent.findMany({
          where: {
            publisherId,
            cfOrderId: event.cfOrderId,
            digitalProductId: event.digitalProductId,
          },
          select: { id: true, status: true, cfProductId: true, payloadJson: true },
        })
      : [];

    const refundEventIds = sameOrder
      .filter((e) => extractClickFunnelsIdentifiers(e.payloadJson).isRefund)
      .map((e) => e.id);
    if (refundEventIds.length > 0) {
      const refunded = await tx.ledgerEntry.count({
        where: {
          referenceType: DIGITAL_PRODUCT_REFUND_REFERENCE,
          referenceId: { in: refundEventIds },
        },
      });
      if (refunded > 0) {
        throw new AppError(
          "INVALID_STATE",
          "This order was already refunded; its commission is already reversed",
          409,
        );
      }
    }

    const targetIds = new Set<string>([event.id]);
    for (const e of sameOrder) {
      if (e.status !== "PROCESSED") continue;
      if ((e.cfProductId ?? null) !== (event.cfProductId ?? null)) continue;
      if (extractClickFunnelsIdentifiers(e.payloadJson).isRefund) continue;
      targetIds.add(e.id);
    }
    const rejectedEventIds = [...targetIds];

    const updated = await tx.webhookEvent.updateMany({
      where: { id: { in: rejectedEventIds }, status: "PROCESSED" },
      data: { status: "REJECTED", errorMessage: `${ADMIN_REJECT_MESSAGE_PREFIX}${trimmedReason}` },
    });
    if (updated.count === 0) {
      throw new AppError("INVALID_STATE", "Only approved conversions can be rejected", 409);
    }

    const reversedAmount = await reverseDigitalProductSaleCommissions(tx, publisherId, rejectedEventIds);

    await tx.auditLog.create({
      data: {
        actorId: adminId,
        action: "digital_product_conversion.rejected",
        entityType: "webhook_event",
        entityId: event.id,
        metadata: {
          reason: trimmedReason,
          publisherId,
          orderId: event.cfOrderId,
          rejectedEventIds,
          reversedAmount,
        },
      },
    });

    return { rejectedEventIds, reversedAmount };
  });

  for (const id of result.rejectedEventIds) {
    await reverseSoloConversionForWebhookEvent(id, "admin_rejected").catch((error) =>
      console.error("[solo] reversal after reject failed", id, error),
    );
  }
  return result;
}
