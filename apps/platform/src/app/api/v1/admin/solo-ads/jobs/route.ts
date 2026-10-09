import { withRealAdmin } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { getSoloJobsLastRun, runSoloJob } from "@/services/solo-jobs.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return withRealAdmin(async (session) => {
    const started = Date.now();
    let results: Record<string, unknown> | null = null;
    try {
      results = await runSoloJob("all", new Date(), "admin");
    } finally {
      await prisma.auditLog
        .create({
          data: {
            actorId: session.user.id,
            action: "solo.jobs.run",
            entityType: "platform_settings",
            entityId: "solo_ads_jobs_last_run",
            metadata: { ok: results !== null, ms: Date.now() - started },
          },
        })
        .catch((error) => console.error("[solo] jobs audit failed", error));
    }
    return Response.json({ data: { results, lastRun: await getSoloJobsLastRun() } });
  });
}
