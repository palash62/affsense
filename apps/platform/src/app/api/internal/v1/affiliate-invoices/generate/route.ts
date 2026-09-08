import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getInternalServiceToken } from "@cpl/shared";
import { errorResponse } from "@/lib/errors";
import { generateAffiliateInvoices } from "@/services/affiliate-invoice.service";

export const runtime = "nodejs";

function verifyServiceToken(request: Request): boolean {
  const token = getInternalServiceToken();
  const provided = request.headers.get("x-service-token");
  if (!token || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Weekly invoice run, meant for a Monday schedule (cron, GitHub Action, or any
 * external trigger). Repeated calls are safe.
 */
export async function POST(request: NextRequest) {
  if (!verifyServiceToken(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid service token", status: 401 } },
      { status: 401 },
    );
  }

  try {
    const data = await generateAffiliateInvoices(new Date());
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
