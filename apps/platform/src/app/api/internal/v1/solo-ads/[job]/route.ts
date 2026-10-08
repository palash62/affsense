import { NextResponse } from "next/server";
import { verifyServiceToken } from "@/lib/internal-service-auth";
import { SOLO_JOBS, runSoloJob, type SoloJobName } from "@/services/solo-jobs.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!verifyServiceToken(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid service token", status: 401 } }, { status: 401 });
  }
  const { job } = await params;
  if (job !== "all" && !(SOLO_JOBS as readonly string[]).includes(job)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown job", status: 404 } }, { status: 404 });
  }
  const started = Date.now();
  try {
    const results = await runSoloJob(job as SoloJobName);
    return NextResponse.json({ data: { job, results, ms: Date.now() - started } });
  } catch (error) {
    console.error(`[solo] job ${job} failed`, error);
    return NextResponse.json({ error: { code: "JOB_FAILED", message: (error as Error).message, status: 500 } }, { status: 500 });
  }
}
