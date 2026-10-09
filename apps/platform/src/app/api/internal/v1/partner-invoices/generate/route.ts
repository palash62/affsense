import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getInternalServiceToken } from "@cpl/shared";
import { errorResponse } from "@/lib/errors";
import { generateDuePartnerInvoices } from "@/services/partner-invoice.service";

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
 * Monthly partner invoice run, meant for the 1st of each month. Invoices the month that just
 * ended plus any earlier month still missing. Repeated calls are safe.
 */
export async function POST(request: NextRequest) {
  if (!verifyServiceToken(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid service token", status: 401 } },
      { status: 401 },
    );
  }

  try {
    const data = await generateDuePartnerInvoices(new Date());
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
