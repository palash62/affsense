import { NextResponse } from "next/server";
import { routeSoloClick } from "@/lib/solo-router";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ pool: string }> }) {
  const { pool } = await params;
  let location: string;
  try {
    location = (await routeSoloClick(request, pool)).location;
  } catch (error) {
    console.error("[solo] router error", error);
    location = process.env.SOLO_ADS_FALLBACK_URL?.trim() || "https://affsense.com";
  }
  const response = NextResponse.redirect(location, 302);
  // The provider token is in this URL; never leak it to the destination.
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

/** Link scanners send HEAD; answer without routing or billing anything. */
export async function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
