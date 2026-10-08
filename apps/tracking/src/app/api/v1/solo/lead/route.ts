import { prisma } from "@cpl/database";
import { recordSoloLead } from "@cpl/tracking-core";
import { originHost, readJsonBody, soloJson, soloPreflight, str } from "@/lib/solo-cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return soloPreflight();
}

/** Browser lead event from the global script (public site key). */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const siteKey = str(body?.k, 64);
  const cid = str(body?.cid, 64);
  if (!siteKey || !cid) return soloJson({ ok: false }, 400);

  const site = await prisma.soloTrackingSite.findUnique({
    where: { siteKey },
    select: { publisherId: true, hosts: { select: { host: true } } },
  });
  if (!site) return soloJson({ ok: false }, 404);

  const host = originHost(request);
  if (host && !site.hosts.some((h) => h.host === host)) {
    const campaignHost = await prisma.soloCampaign.findFirst({
      where: { publisherId: site.publisherId, destinationHost: host },
      select: { id: true },
    });
    if (!campaignHost) return soloJson({ ok: false, reason: "unknown_host" }, 403);
  }

  try {
    const result = await recordSoloLead({
      publisherId: site.publisherId,
      soloClickId: cid,
      email: str(body?.email),
      source: "SCRIPT",
      eventKey: str(body?.key, 120),
    });
    return soloJson(result.ok ? { ok: true, status: result.status } : { ok: false, reason: result.reason }, result.ok ? 200 : 422);
  } catch (error) {
    console.error("[solo] lead failed", error);
    return soloJson({ ok: false }, 500);
  }
}
