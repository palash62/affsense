/**
 * Re-queue EmailSend rows stuck in QUEUED after their scheduled_at.
 *
 * Usage (from repo root, with apps/platform/.env loaded):
 *   set -a && source apps/platform/.env && set +a
 *   npx tsx apps/platform/scripts/reconcile-email-sends.ts
 *
 * Options:
 *   --dry-run   Print matches only (default if DRY_RUN=1)
 *   --minutes=N Stuck if scheduled_at older than N minutes (default 15)
 */
import { prisma } from "../src/lib/prisma";
import {
  enqueueEmailSend,
  removeEmailSendJob,
  closeEmailQueue,
} from "../src/modules/email-marketing/queue/email-queue";

function parseArgs(argv: string[]) {
  let dryRun = process.env.DRY_RUN === "1";
  let minutes = 15;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    const m = arg.match(/^--minutes=(\d+)$/);
    if (m) minutes = Math.max(1, Number(m[1]));
  }
  return { dryRun, minutes };
}

async function main() {
  const { dryRun, minutes } = parseArgs(process.argv.slice(2));
  const cutoff = new Date(Date.now() - minutes * 60_000);

  const stuck = await prisma.emailSend.findMany({
    where: {
      status: "QUEUED",
      scheduledAt: { lt: cutoff },
    },
    select: {
      id: true,
      advertiserId: true,
      scheduledAt: true,
      attemptCount: true,
      error: true,
      createdAt: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: 500,
  });

  console.log(
    `[reconcile-email-sends] found ${stuck.length} QUEUED send(s) with scheduled_at < ${cutoff.toISOString()} (dryRun=${dryRun})`,
  );

  let requeued = 0;
  for (const send of stuck) {
    console.log(
      `  ${send.id} scheduled=${send.scheduledAt.toISOString()} attempts=${send.attemptCount} error=${send.error ?? "-"}`,
    );
    if (dryRun) continue;

    // Drop failed/completed BullMQ job so jobId can be reused.
    await removeEmailSendJob(send.id);
    await enqueueEmailSend(send.id, new Date());
    requeued += 1;
  }

  if (!dryRun) {
    console.log(`[reconcile-email-sends] re-queued ${requeued} send(s)`);
  }

  await closeEmailQueue();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[reconcile-email-sends] fatal:", err);
  await closeEmailQueue().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
