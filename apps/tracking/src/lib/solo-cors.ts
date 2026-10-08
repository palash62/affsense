export const SOLO_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

export function soloJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: SOLO_CORS_HEADERS });
}

export function soloPreflight() {
  return new Response(null, { status: 204, headers: SOLO_CORS_HEADERS });
}

/** Beacons arrive as text/plain to avoid a CORS preflight; parse either way. */
export async function readJsonBody(request: Request, maxBytes = 4096): Promise<Record<string, unknown> | null> {
  const text = await request.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function originHost(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export const str = (value: unknown, max = 320) => (typeof value === "string" ? value.trim().slice(0, max) : null);
