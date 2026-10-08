import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getInternalServiceToken } from "@cpl/shared";
import { prisma } from "@/lib/prisma";
import { notifyAffiliateEarning, notifyUserById } from "@/services/notify.service";

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

function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export async function POST(request: NextRequest) {
  if (!verifyServiceToken(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid service token", status: 401 } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as {
      advertiserId?: unknown;
      publisherId?: unknown;
      offerId?: unknown;
      amount?: unknown;
      conversionId?: unknown;
    };

    const advertiserId = typeof body.advertiserId === "string" ? body.advertiserId.trim() : "";
    const publisherId = typeof body.publisherId === "string" ? body.publisherId.trim() : "";
    const offerId = typeof body.offerId === "string" ? body.offerId.trim() : "";
    const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);

    if (
      Boolean(advertiserId) === Boolean(publisherId) ||
      !offerId ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Exactly one of advertiserId or publisherId, plus offerId and a positive amount, are required",
            status: 422,
          },
        },
        { status: 422 },
      );
    }

    const offer = await prisma.cpaOffer.findUnique({
      where: { id: offerId },
      select: { name: true },
    });

    const offerLabel = offer?.name?.trim() || "CPA offer";

    if (publisherId) {
      notifyAffiliateEarning(publisherId, { source: "cpa", amount, label: offerLabel });
      return NextResponse.json({ ok: true });
    }

    const amountLabel = formatUsd(amount);

    void notifyUserById(advertiserId, {
      title: "CPA sale recorded",
      message: `A sale on "${offerLabel}" was recorded for ${amountLabel}. Earnings are pending until the hold period ends.`,
      actionPath: "/advertiser/cpa-offers/wallet",
      notificationType: "cpa.sale",
    }).catch((error) => {
      console.error("[cpa-sale-notify] notify failed", error);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cpa-sale-notify] error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to process notify", status: 500 } },
      { status: 500 },
    );
  }
}
