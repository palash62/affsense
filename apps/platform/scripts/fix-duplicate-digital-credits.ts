/**
 * One-off repair: ClickFunnels sends two webhooks per purchase (orders/invoice.paid plus
 * one-time-order / subscription.invoice.paid). Events received before external_event_key
 * existed were both credited. This keeps the earliest credited event per order and reverses
 * the commission on the others.
 *
 * An UNPAID affiliate invoice holding a duplicate credit is cancelled first so the corrected
 * earnings can be invoiced again. A PAID invoice stops the script.
 *
 * Dry-run by default. Pass --apply to write.
 *
 * Usage (from apps/platform, with .env loaded):
 *   set -a && source .env && set +a
 *   npx tsx scripts/fix-duplicate-digital-credits.ts
 *   npx tsx scripts/fix-duplicate-digital-credits.ts --apply --admin-email=you@example.com
 */
import { prisma } from "../src/lib/prisma";
import { cancelAffiliateInvoice } from "../src/services/affiliate-invoice.service";
import {
  DIGITAL_PRODUCT_REJECT_REFERENCE,
  DIGITAL_PRODUCT_SALE_REFERENCE,
  reverseDigitalProductSaleCommissions,
} from "../src/services/wallet.service";

const APPLY = process.argv.includes("--apply");
const ADMIN_EMAIL =
  process.argv.find((arg) => arg.startsWith("--admin-email="))?.split("=")[1] ?? "ppalash62@gmail.com";
const DUPLICATE_MESSAGE = "Duplicate ClickFunnels webhook for an order already credited";
const REVERSAL_DESCRIPTION = "Duplicate ClickFunnels webhook";

type Credit = {
  entryId: string;
  eventId: string;
  publisherId: string;
  amount: number;
  invoiceId: string | null;
  eventType: string;
  eventAt: Date;
  orderKey: string;
};

function orderKeyFromPayload(payload: unknown): string | null {
  const data = (payload as { data?: Record<string, unknown> } | null)?.data;
  const order = data?.order as Record<string, unknown> | undefined;
  if (data?.id == null || order?.id == null) return null;
  return `${String(order.id)}:${String(data.id)}`;
}

async function findDuplicates(): Promise<Credit[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: { referenceType: DIGITAL_PRODUCT_SALE_REFERENCE, type: "CREDIT", referenceId: { not: null } },
    select: { id: true, referenceId: true, amount: true, invoiceId: true, wallet: { select: { userId: true } } },
  });
  const reversed = new Set(
    (
      await prisma.ledgerEntry.findMany({
        where: { referenceType: DIGITAL_PRODUCT_REJECT_REFERENCE },
        select: { referenceId: true },
      })
    ).map((e) => e.referenceId),
  );

  const events = await prisma.webhookEvent.findMany({
    where: { id: { in: entries.map((e) => e.referenceId!) }, externalEventKey: null },
    select: { id: true, eventType: true, createdAt: true, payloadJson: true },
  });
  const eventById = new Map(events.map((e) => [e.id, e]));

  const groups = new Map<string, Credit[]>();
  for (const entry of entries) {
    const event = eventById.get(entry.referenceId!);
    if (!event || reversed.has(event.id)) continue;
    const orderKey = orderKeyFromPayload(event.payloadJson);
    if (!orderKey) continue;
    const key = `${entry.wallet.userId}:${orderKey}`;
    const credit: Credit = {
      entryId: entry.id,
      eventId: event.id,
      publisherId: entry.wallet.userId,
      amount: Number(entry.amount),
      invoiceId: entry.invoiceId,
      eventType: event.eventType,
      eventAt: event.createdAt,
      orderKey,
    };
    groups.set(key, [...(groups.get(key) ?? []), credit]);
  }

  const duplicates: Credit[] = [];
  for (const credits of groups.values()) {
    if (credits.length < 2) continue;
    credits.sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
    duplicates.push(...credits.slice(1));
  }
  return duplicates;
}

async function main() {
  const duplicates = await findDuplicates();
  const total = duplicates.reduce((sum, d) => sum + d.amount, 0);

  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${duplicates.length} duplicate credits, $${total.toFixed(2)}`);
  for (const d of duplicates) {
    console.log(`  order ${d.orderKey}  ${d.eventType}  event ${d.eventId}  $${d.amount.toFixed(2)}`);
  }
  if (duplicates.length === 0) return;

  const invoiceIds = [...new Set(duplicates.map((d) => d.invoiceId).filter((id): id is string => !!id))];
  const invoices = await prisma.affiliateInvoice.findMany({
    where: { id: { in: invoiceIds } },
    select: { id: true, number: true, status: true, total: true },
  });
  for (const invoice of invoices) {
    console.log(`  holds duplicates: ${invoice.number} ${invoice.status} $${Number(invoice.total).toFixed(2)}`);
    if (invoice.status === "PAID") {
      throw new Error(`${invoice.number} is already PAID; fix it by hand instead`);
    }
  }

  if (!APPLY) return;

  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw new Error(`No ADMIN user with email ${ADMIN_EMAIL}`);

  for (const invoice of invoices) {
    if (invoice.status !== "UNPAID") continue;
    await cancelAffiliateInvoice(invoice.id, "Duplicate ClickFunnels webhook credits", admin.id);
    console.log(`  cancelled ${invoice.number}`);
  }

  const byPublisher = new Map<string, Credit[]>();
  for (const d of duplicates) byPublisher.set(d.publisherId, [...(byPublisher.get(d.publisherId) ?? []), d]);

  for (const [publisherId, credits] of byPublisher) {
    const eventIds = credits.map((c) => c.eventId);
    const reversedAmount = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM wallets WHERE user_id = ${publisherId} FOR UPDATE`;
      const amount = await reverseDigitalProductSaleCommissions(tx, publisherId, eventIds, REVERSAL_DESCRIPTION);
      await tx.webhookEvent.updateMany({
        where: { id: { in: eventIds } },
        data: { status: "DUPLICATE", errorMessage: DUPLICATE_MESSAGE },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: "digital_product_conversion.duplicate_reversed",
          entityType: "user",
          entityId: publisherId,
          metadata: { eventIds, reversedAmount: amount, cancelledInvoices: invoices.map((i) => i.number) },
        },
      });
      return amount;
    });
    console.log(`  publisher ${publisherId}: reversed $${reversedAmount.toFixed(2)}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
