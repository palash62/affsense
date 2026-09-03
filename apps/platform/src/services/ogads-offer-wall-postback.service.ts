import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "@/lib/errors";
import { applyOfferWallAffiliatePayout } from "@/lib/ogads-offer-wall-settings";
import { creditWallet } from "@/services/wallet.service";
import { loadOgadsOfferWallConfig } from "@/services/ogads-offer-wall-settings.service";

function pickParam(
  searchParams: URLSearchParams,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = searchParams.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

function dayBucket(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function handleOgadsOfferWallPostback(request: Request) {
  const config = await loadOgadsOfferWallConfig();
  if (!config.enabled) {
    throw new AppError("OFFER_WALL_DISABLED", "Offer Wall is disabled", 403);
  }

  const { searchParams } = new URL(request.url);
  const secret = pickParam(searchParams, "secret");
  if (config.postbackSecret) {
    if (!secret || secret !== config.postbackSecret) {
      throw new AppError("UNAUTHORIZED", "Invalid postback secret", 401);
    }
  }

  const publisherId = pickParam(searchParams, "aff_sub4", "aff_sub", "user_id", "userid");
  const offerId = pickParam(searchParams, "offer_id", "offerid", "oid") ?? "unknown";
  const payoutRaw = pickParam(searchParams, "payout", "amount", "revenue") ?? "0";
  const ip = pickParam(searchParams, "ip", "session_ip");
  const txnId = pickParam(
    searchParams,
    "transaction_id",
    "txn_id",
    "click_id",
    "conversion_id",
    "event_id",
  );

  if (!publisherId) {
    throw Errors.validation("aff_sub4 (publisher id) is required");
  }

  const publisher = await prisma.user.findFirst({
    where: { id: publisherId, role: "PUBLISHER" },
    select: { id: true },
  });
  if (!publisher) {
    throw Errors.notFound("Publisher");
  }

  const networkPayout = Number(payoutRaw);
  if (!Number.isFinite(networkPayout) || networkPayout < 0) {
    throw Errors.validation("Invalid payout");
  }

  const payout = applyOfferWallAffiliatePayout(networkPayout, config.affiliatePercent);

  const externalKey =
    txnId ??
    `${publisherId}:${offerId}:${dayBucket()}:${networkPayout.toFixed(4)}`;

  const existing = await prisma.offerwallConversion.findUnique({
    where: { externalKey },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, duplicate: true, conversionId: existing.id };
  }

  const rawQuery = Object.fromEntries(searchParams.entries());

  try {
    const conversion = await prisma.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: publisherId },
        create: { userId: publisherId, balance: 0, currency: "USD" },
        update: {},
      });

      const row = await tx.offerwallConversion.create({
        data: {
          publisherId,
          offerId,
          externalKey,
          payout,
          ip,
          rawQuery,
        },
      });

      if (payout > 0) {
        await creditWallet(
          tx,
          publisherId,
          payout,
          "OFFERWALL_CONVERSION",
          row.id,
          `OGAds offer ${offerId}`,
        );
      }

      return row;
    });

    return { ok: true, duplicate: false, conversionId: conversion.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const again = await prisma.offerwallConversion.findUnique({
        where: { externalKey },
        select: { id: true },
      });
      if (again) {
        return { ok: true, duplicate: true, conversionId: again.id };
      }
    }
    throw error;
  }
}
