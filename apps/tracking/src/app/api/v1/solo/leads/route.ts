import { prisma } from "@cpl/database";
import { recordSoloLead, sha256Hex } from "@cpl/tracking-core";
import { readJsonBody, soloJson, soloPreflight, str } from "@/lib/solo-cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return soloPreflight();
}

/**
 * Server-to-server lead API for affiliates whose forms post to their own
 * backend or autoresponder. Auth: `Authorization: Bearer <lead API key>`.
 * Body: { "click_id": "sc_…", "email": "…", "event_id": "optional idempotency key" }
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!key || key.length > 128) return soloJson({ error: { code: "UNAUTHORIZED", message: "Missing API key" } }, 401);

  const site = await prisma.soloTrackingSite.findUnique({
    where: { apiKeyHash: sha256Hex(key) },
    select: { publisherId: true },
  });
  if (!site) return soloJson({ error: { code: "UNAUTHORIZED", message: "Invalid API key" } }, 401);

  const body = await readJsonBody(request, 8192);
  const clickId = str(body?.click_id, 64);
  if (!clickId) return soloJson({ error: { code: "VALIDATION_ERROR", message: "click_id is required" } }, 422);

  try {
    const result = await recordSoloLead({
      publisherId: site.publisherId,
      soloClickId: clickId,
      email: str(body?.email),
      source: "API",
      eventKey: str(body?.event_id, 120),
    });
    if (!result.ok) return soloJson({ error: { code: "REJECTED", message: result.reason } }, 422);
    return soloJson({ data: { status: result.status, id: result.leadId } });
  } catch (error) {
    console.error("[solo] server lead failed", error);
    return soloJson({ error: { code: "INTERNAL_ERROR" } }, 500);
  }
}
