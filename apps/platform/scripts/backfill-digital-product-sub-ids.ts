/**
 * Re-attribute subId / src / clickId on processed digital product sales using the buyer's
 * own visit (aff_click or subid/source on the CF landing URL) instead of the affiliate's
 * latest click. Renewals of a fixed subscription inherit the corrected values.
 *
 * Dry run by default. Usage (from apps/platform, with .env loaded):
 *   npx tsx scripts/backfill-digital-product-sub-ids.ts
 *   npx tsx scripts/backfill-digital-product-sub-ids.ts --apply
 */
import { prisma } from "../src/lib/prisma";
import {
  buildAffiliateParamCandidates,
  extractLandingTrackingParams,
  loadDigitalProductAffiliateParamNames,
  resolveDigitalProductWebhookAttribution,
} from "../src/lib/clickfunnels-webhook-attribution";
import { loadClickFunnelsWebhookConfig } from "../src/services/clickfunnels-webhook-settings.service";

const TAG = "[backfill-digital-product-sub-ids]";

async function main() {
  const apply = process.argv.includes("--apply");
  const config = await loadClickFunnelsWebhookConfig();
  const paramNames = buildAffiliateParamCandidates(
    config.affiliateTrackingParam,
    await loadDigitalProductAffiliateParamNames(),
  );

  const rows = await prisma.webhookEvent.findMany({
    where: { status: "PROCESSED", publisherId: { not: null } },
    select: {
      id: true,
      publisherId: true,
      clickId: true,
      subId: true,
      src: true,
      payloadJson: true,
      digitalProductId: true,
      cfSubscriptionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`${TAG} candidates=${rows.length} mode=${apply ? "APPLY" : "DRY RUN"}`);

  let changed = 0;
  let renewalsChanged = 0;
  let noVisitParams = 0;
  let otherPublisher = 0;

  for (const row of rows) {
    const landing = extractLandingTrackingParams(row.payloadJson, paramNames);
    if (!landing.clickId && !landing.subId && !landing.source) {
      noVisitParams += 1;
      continue;
    }

    const next = await resolveDigitalProductWebhookAttribution({
      body: row.payloadJson,
      platformParam: config.affiliateTrackingParam,
      at: row.createdAt,
      productId: row.digitalProductId ?? undefined,
    });
    if (next.publisherId !== row.publisherId) {
      otherPublisher += 1;
      continue;
    }
    if (next.subId === row.subId && next.src === row.src && next.clickId === row.clickId) continue;

    changed += 1;
    console.log(
      `  ${row.id} ${row.createdAt.toISOString()} sub ${row.subId ?? "-"} -> ${next.subId ?? "-"} | src ${row.src ?? "-"} -> ${next.src ?? "-"} | click ${row.clickId ?? "-"} -> ${next.clickId ?? "-"}`,
    );

    const data = { clickId: next.clickId, subId: next.subId, src: next.src };
    const subscription = await prisma.digitalProductSubscriptionAttribution.findFirst({
      where: { originalWebhookEventId: row.id, publisherId: row.publisherId! },
      select: { id: true, cfSubscriptionId: true },
    });
    const renewals = subscription
      ? await prisma.webhookEvent.findMany({
          where: {
            id: { not: row.id },
            cfSubscriptionId: subscription.cfSubscriptionId,
            publisherId: row.publisherId,
            subId: row.subId,
            src: row.src,
          },
          select: { id: true },
        })
      : [];
    renewalsChanged += renewals.length;
    if (renewals.length) console.log(`    + ${renewals.length} renewal(s) of ${subscription!.cfSubscriptionId}`);

    if (apply) {
      await prisma.$transaction([
        prisma.webhookEvent.update({ where: { id: row.id }, data }),
        ...(subscription
          ? [prisma.digitalProductSubscriptionAttribution.update({ where: { id: subscription.id }, data })]
          : []),
        ...(renewals.length
          ? [
              prisma.webhookEvent.updateMany({
                where: { id: { in: renewals.map((r) => r.id) } },
                data: { subId: next.subId, src: next.src },
              }),
            ]
          : []),
      ]);
    }
  }

  console.log(
    `${TAG} ${apply ? "updated" : "would update"}=${changed} renewals=${renewalsChanged} unchanged=${rows.length - changed - noVisitParams - otherPublisher} noVisitParams=${noVisitParams} skippedOtherPublisher=${otherPublisher}`,
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(`${TAG} fatal:`, err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
