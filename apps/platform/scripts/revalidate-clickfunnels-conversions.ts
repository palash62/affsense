/**
 * Re-run the ClickFunnels conversion rules (product mapping, Affsense attribution,
 * subscription attribution, idempotency) on existing PROCESSED webhook_events.
 *
 * Dry-run by default: prints what would change. Pass --apply to write.
 * Events whose publisher already has a PAID invoice covering the event date are
 * reported only and never changed.
 *
 * Usage (from apps/platform, with .env loaded):
 *   set -a && source .env && set +a
 *   npx tsx scripts/revalidate-clickfunnels-conversions.ts
 *   npx tsx scripts/revalidate-clickfunnels-conversions.ts --apply
 *   npx tsx scripts/revalidate-clickfunnels-conversions.ts --from=2026-01-01 --limit=5000
 */
import { prisma } from "../src/lib/prisma";
import {
  CONVERSION_REJECT_REASONS,
  createPrismaConversionDeps,
  validateClickFunnelsConversion,
  type ConversionValidationResult,
  type StoredSubscriptionAttribution,
} from "../src/lib/clickfunnels-conversion-validation";
import { extractOrderFieldsFromClickFunnelsPayload } from "../src/lib/clickfunnels-webhook-payload";
import { resolveDigitalProductCommissionById } from "../src/lib/digital-product-commission";
import { loadClickFunnelsWebhookConfig } from "../src/services/clickfunnels-webhook-settings.service";

const TAG = "[revalidate-clickfunnels-conversions]";

type Outcome = "valid" | "reattribute" | "reject" | "duplicate";

function parseArgs(argv: string[]) {
  let apply = false;
  let from: Date | undefined;
  let limit = 20000;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--from=")) {
      const d = new Date(arg.slice("--from=".length));
      if (!Number.isNaN(d.getTime())) from = d;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { apply, from, limit };
}

const CLEARED_COMMISSION = {
  commissionRate: null,
  commissionAmount: null,
  digitalCommissionPlanId: null,
} as const;

async function loadPaidInvoicePeriods() {
  const invoices = await prisma.affiliateInvoice.findMany({
    where: { status: "PAID" },
    select: { publisherId: true, periodStart: true, periodEnd: true, number: true },
  });
  const byPublisher = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const list = byPublisher.get(inv.publisherId) ?? [];
    list.push(inv);
    byPublisher.set(inv.publisherId, list);
  }
  return (publisherId: string | null, at: Date): string | null => {
    if (!publisherId) return null;
    const match = byPublisher
      .get(publisherId)
      ?.find((inv) => inv.periodStart <= at && at <= inv.periodEnd);
    return match?.number ?? null;
  };
}

async function recomputeSnapshot(body: unknown, result: ConversionValidationResult) {
  if (!result.publisherId || !result.productId) return CLEARED_COMMISSION;
  const fields = extractOrderFieldsFromClickFunnelsPayload(body);
  const resolved = await resolveDigitalProductCommissionById({
    productId: result.productId,
    upsellId: result.upsellId,
    amount: fields.amount,
    publisherId: result.publisherId,
  });
  if (resolved.matched === "fallback" || resolved.commission == null) return CLEARED_COMMISSION;
  return {
    commissionRate: Math.round(resolved.rate * 10000) / 100,
    commissionAmount: resolved.commission,
    digitalCommissionPlanId: resolved.planId ?? null,
  };
}

async function main() {
  const { apply, from, limit } = parseArgs(process.argv.slice(2));
  const config = await loadClickFunnelsWebhookConfig();
  const param = config.affiliateTrackingParam || "affsense_id";
  const paidInvoiceFor = await loadPaidInvoicePeriods();

  const events = await prisma.webhookEvent.findMany({
    where: {
      source: "CLICKFUNNELS",
      status: "PROCESSED",
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select: {
      id: true,
      eventType: true,
      publisherId: true,
      payloadJson: true,
      externalEventKey: true,
      commissionAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const seenKeys = new Map<string, string>();
  const keyed = await prisma.webhookEvent.findMany({
    where: { externalEventKey: { not: null } },
    select: { id: true, externalEventKey: true },
  });
  for (const row of keyed) seenKeys.set(row.externalEventKey!, row.id);

  // Subscriptions discovered earlier in this run (chronological), so renewals
  // can inherit the original affiliate even before --apply persists them.
  const runSubscriptions = new Map<string, StoredSubscriptionAttribution>();

  console.log(
    `${TAG} candidates=${events.length} apply=${apply} param=${param}${from ? ` from=${from.toISOString()}` : ""}`,
  );

  const counts: Record<Outcome | "locked", number> = {
    valid: 0,
    reattribute: 0,
    reject: 0,
    duplicate: 0,
    locked: 0,
  };
  const rejectReasons = new Map<string, number>();

  for (const ev of events) {
    if (ev.eventType === "test") continue;

    const prismaDeps = createPrismaConversionDeps({
      body: ev.payloadJson,
      at: ev.createdAt,
      platformParam: param,
    });
    const result = await validateClickFunnelsConversion({
      body: ev.payloadJson,
      at: ev.createdAt,
      platformParam: param,
      deps: {
        ...prismaDeps,
        async findSubscription(key) {
          return runSubscriptions.get(key) ?? prismaDeps.findSubscription(key);
        },
      },
    });

    let outcome: Outcome;
    if (result.status !== "PROCESSED") {
      outcome = "reject";
    } else if (
      result.externalEventKey &&
      seenKeys.has(result.externalEventKey) &&
      seenKeys.get(result.externalEventKey) !== ev.id
    ) {
      outcome = "duplicate";
    } else if (result.publisherId !== ev.publisherId) {
      outcome = "reattribute";
    } else {
      outcome = "valid";
    }

    const lockedBy = outcome === "valid" ? null : paidInvoiceFor(ev.publisherId, ev.createdAt);
    const detail =
      outcome === "reject"
        ? `${result.reason}`
        : outcome === "duplicate"
          ? `key=${result.externalEventKey} first=${seenKeys.get(result.externalEventKey!)}`
          : outcome === "reattribute"
            ? `pub ${ev.publisherId ?? "-"} -> ${result.publisherId ?? "-"}`
            : "";

    if (lockedBy) {
      counts.locked += 1;
      console.log(
        `  LOCKED ${ev.id} ${ev.createdAt.toISOString()} ${outcome} ${detail} (paid invoice ${lockedBy}) — not changed`,
      );
      continue;
    }

    counts[outcome] += 1;
    if (outcome === "reject" && result.reason) {
      rejectReasons.set(result.reason, (rejectReasons.get(result.reason) ?? 0) + 1);
    }
    if (outcome !== "valid") {
      console.log(
        `  ${outcome.toUpperCase()} ${ev.id} ${ev.createdAt.toISOString()} ${detail} commission=${ev.commissionAmount ?? "-"}`,
      );
    }

    if (outcome === "valid" || outcome === "reattribute") {
      if (result.externalEventKey) seenKeys.set(result.externalEventKey, ev.id);
      const subKey = result.identifiers.subscriptionKey;
      if (result.storeSubscription && subKey && result.productId && result.publisherId) {
        runSubscriptions.set(subKey, {
          productId: result.productId,
          upsellId: result.upsellId,
          publisherId: result.publisherId,
          clickId: result.clickId,
          subId: result.subId,
          subId2: result.subId2,
          subId3: result.subId3,
          src: result.src,
          affiliateRef: result.affiliateRef,
          originalOrderId: result.identifiers.orderId,
        });
      }
    }

    if (!apply) continue;

    const cfFields = {
      cfProductId: result.cfProductId,
      cfOrderId: result.identifiers.orderId,
      cfSubscriptionId: result.identifiers.subscriptionKey,
      isRecurring: result.isRecurring,
      digitalProductId: result.productId,
    };

    if (outcome === "reject") {
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: {
          ...cfFields,
          ...CLEARED_COMMISSION,
          status: "IGNORED",
          publisherId: null,
          errorMessage: `${result.reason}: ${CONVERSION_REJECT_REASONS[result.reason!]}`,
        },
      });
      continue;
    }

    if (outcome === "duplicate") {
      await prisma.webhookEvent.update({
        where: { id: ev.id },
        data: {
          ...cfFields,
          ...CLEARED_COMMISSION,
          status: "DUPLICATE",
          publisherId: null,
          errorMessage: "DUPLICATE_EVENT: This ClickFunnels payment was already recorded",
        },
      });
      continue;
    }

    const snapshot =
      outcome === "reattribute" ? await recomputeSnapshot(ev.payloadJson, result) : {};
    await prisma.webhookEvent.update({
      where: { id: ev.id },
      data: {
        ...cfFields,
        ...snapshot,
        publisherId: result.publisherId,
        affiliateRef: result.affiliateRef,
        clickId: result.clickId,
        subId: result.subId,
        src: result.src,
        externalEventKey: ev.externalEventKey ?? result.externalEventKey,
      },
    });

    const subKey = result.identifiers.subscriptionKey;
    if (result.storeSubscription && subKey && result.productId && result.publisherId) {
      await prisma.digitalProductSubscriptionAttribution
        .create({
          data: {
            cfSubscriptionId: subKey.slice(0, 191),
            productId: result.productId,
            upsellId: result.upsellId,
            publisherId: result.publisherId,
            clickId: result.clickId,
            subId: result.subId,
            src: result.src,
            affiliateRef: result.affiliateRef,
            originalOrderId: result.identifiers.orderId,
            originalWebhookEventId: ev.id,
          },
        })
        .catch(() => {
          // Already stored — keep the first attribution.
        });
    }
  }

  const reasons = [...rejectReasons.entries()].map(([r, n]) => `${r}=${n}`).join(" ");
  console.log(
    `${TAG} ${apply ? "applied" : "dry-run"} valid=${counts.valid} reattribute=${counts.reattribute} reject=${counts.reject} duplicate=${counts.duplicate} locked=${counts.locked}${reasons ? ` | ${reasons}` : ""}`,
  );
  if (!apply) console.log(`${TAG} re-run with --apply to write these changes.`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`${TAG} fatal:`, err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
