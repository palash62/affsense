/**
 * Backfill lead + affiliate fields on existing ClickFunnels webhook_events
 * by re-parsing stored payloadJson (Classic CF nesting + landing_page ?affsense_id=).
 *
 * Usage (from apps/platform, with .env loaded):
 *   set -a && source .env && set +a
 *   npx tsx scripts/backfill-clickfunnels-webhook-fields.ts
 *   npx tsx scripts/backfill-clickfunnels-webhook-fields.ts --dry-run
 *
 * Or from repo root:
 *   set -a && source apps/platform/.env && set +a
 *   cd apps/platform && npx tsx scripts/backfill-clickfunnels-webhook-fields.ts
 */
import { prisma } from "../src/lib/prisma";
import { extractAffiliateRefFromWebhookPayload } from "../src/lib/clickfunnels-webhook-attribution";
import { extractLeadFromClickFunnelsPayload } from "../src/lib/clickfunnels-webhook-payload";
import {
  loadClickFunnelsWebhookConfig,
  resolvePublisherFromAffiliateRef,
} from "../src/services/clickfunnels-webhook-settings.service";

function parseArgs(argv: string[]) {
  let dryRun = process.env.DRY_RUN === "1";
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
  }
  return { dryRun };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const config = await loadClickFunnelsWebhookConfig();
  const param = config.affiliateTrackingParam || "affsense_id";

  const rows = await prisma.webhookEvent.findMany({
    where: {
      OR: [
        { leadEmail: null },
        { leadName: null },
        { publisherId: null },
        { affiliateRef: null },
      ],
    },
    select: {
      id: true,
      leadEmail: true,
      leadName: true,
      affiliateRef: true,
      publisherId: true,
      payloadJson: true,
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  console.log(
    `[backfill-clickfunnels-webhook-fields] candidates=${rows.length} dryRun=${dryRun} param=${param}`,
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const lead = extractLeadFromClickFunnelsPayload(row.payloadJson);
    const affiliateRef =
      row.affiliateRef ??
      extractAffiliateRefFromWebhookPayload(row.payloadJson, param) ??
      null;
    const attribution = await resolvePublisherFromAffiliateRef(affiliateRef);

    const nextLeadEmail = row.leadEmail ?? lead.leadEmail;
    const nextLeadName = row.leadName ?? lead.leadName;
    const nextAffiliateRef = row.affiliateRef ?? attribution.affiliateRef;
    const nextPublisherId = row.publisherId ?? attribution.publisherId;

    const changed =
      nextLeadEmail !== row.leadEmail ||
      nextLeadName !== row.leadName ||
      nextAffiliateRef !== row.affiliateRef ||
      nextPublisherId !== row.publisherId;

    if (!changed) {
      skipped += 1;
      continue;
    }

    console.log(
      `  ${row.id} email=${nextLeadEmail ?? "-"} name=${nextLeadName ?? "-"} aff=${nextAffiliateRef ?? "-"} pub=${nextPublisherId ?? "-"}`,
    );

    if (!dryRun) {
      await prisma.webhookEvent.update({
        where: { id: row.id },
        data: {
          leadEmail: nextLeadEmail,
          leadName: nextLeadName,
          affiliateRef: nextAffiliateRef,
          publisherId: nextPublisherId,
        },
      });
    }
    updated += 1;
  }

  console.log(
    `[backfill-clickfunnels-webhook-fields] ${dryRun ? "would update" : "updated"}=${updated} skipped=${skipped}`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[backfill-clickfunnels-webhook-fields] fatal:", err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
