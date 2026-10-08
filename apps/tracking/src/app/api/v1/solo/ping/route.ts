import { recordSoloScriptPing } from "@cpl/tracking-core";
import { originHost, readJsonBody, soloJson, soloPreflight, str } from "@/lib/solo-cors";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return soloPreflight();
}

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  const siteKey = str(body?.k, 64);
  // The browser sets Origin; prefer it over the self-reported host.
  const host = originHost(request) ?? str(body?.host, 191);
  if (!siteKey || !host) return soloJson({ ok: false }, 400);
  try {
    const result = await recordSoloScriptPing(siteKey, host);
    return soloJson({ ok: result.ok }, result.ok ? 200 : 404);
  } catch (error) {
    console.error("[solo] ping failed", error);
    return soloJson({ ok: false }, 500);
  }
}
