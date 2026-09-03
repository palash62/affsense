import { prisma } from "@cpl/database";
import { Prisma } from "@prisma/client";
import {
  buildPlatformCpaSaleNotifyUrl,
  getInternalServiceToken,
} from "@cpl/shared";
import {
  dispatchCpaConversionPostbacks,
  getCpaNetworkPostbackConfig,
  isPostbackSecurityAuthorized,
  resolveCpaClickAttribution,
  resolveInboundClickId,
  inboundClickIdErrorMessage,
  normalizeClickId,
} from "@cpl/tracking-core";

type ClickRow = {
  id: string;
  offerId: string;
  advertiserId: string | null;
  src: string | null;
  subId: string | null;
};

async function readParams(request: Request) {
  const { searchParams } = new URL(request.url);
  let body: Record<string, unknown> = {};
  if (request.method === "POST") {
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }
  }

  const getParam = (key: string): string | null => {
    const fromQuery = searchParams.get(key);
    if (fromQuery != null) return fromQuery;
    const fromBody = body[key];
    if (typeof fromBody === "string" || typeof fromBody === "number") {
      return String(fromBody);
    }
    return null;
  };

  return { searchParams, body, getParam };
}

function parsePayout(payoutRaw: string | null): Prisma.Decimal | null {
  if (!payoutRaw || payoutRaw === "{payout}") return null;
  const n = Number(payoutRaw);
  if (!Number.isFinite(n) || n < 0) return null;
  return new Prisma.Decimal(n);
}

function clickIdFailureResponse(getParam: (key: string) => string | null, clickFound: boolean) {
  const rawClickId = getParam("click_id");
  const rawAffClickId = getParam("aff_click_id");
  const raw = (rawClickId ?? rawAffClickId ?? "").trim();

  let reason: "missing" | "placeholder" | "unknown" = "missing";
  if (!raw) {
    reason = "missing";
  } else if (!normalizeClickId(raw)) {
    reason = "placeholder";
  } else {
    reason = "unknown";
  }

  return Response.json(
    {
      success: false,
      message: inboundClickIdErrorMessage(reason),
      code: clickFound ? "CLICK_NOT_FOUND" : reason === "placeholder" ? "PLACEHOLDER_CLICK_ID" : reason === "missing" ? "MISSING_CLICK_ID" : "UNKNOWN_CLICK_ID",
    },
    { status: 404 },
  );
}

async function loadClick(inboundClickId: string | null): Promise<ClickRow | null> {
  if (!inboundClickId) return null;
  return prisma.cpaOfferClick.findUnique({
    where: { id: inboundClickId },
    select: {
      id: true,
      offerId: true,
      advertiserId: true,
      src: true,
      subId: true,
    },
  });
}

function notifyAdvertiserCpaSale(input: {
  advertiserId: string;
  offerId: string;
  amount: number;
  conversionId: string;
}) {
  const token = getInternalServiceToken();
  if (!token) {
    console.error("[pbtr] CPA sale notify skipped: INTERNAL_SERVICE_TOKEN not configured");
    return;
  }

  void fetch(buildPlatformCpaSaleNotifyUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": token,
    },
    body: JSON.stringify(input),
  }).catch((error) => {
    console.error("[pbtr] CPA sale notify request failed", error);
  });
}

async function createConversionAndDispatch(input: {
  offerId: string;
  attribution: ReturnType<typeof resolveCpaClickAttribution>;
  payout: Prisma.Decimal | null;
  rawPayload: Prisma.InputJsonValue;
}) {
  const offer = await prisma.cpaOffer.findUnique({
    where: { id: input.offerId },
    select: { payout: true, name: true },
  });

  // Advertiser earning always uses the offer's configured payout.
  // Network-reported ?payout= is kept in rawQuery for audit only.
  const effectivePayout = offer?.payout ?? input.payout ?? null;

  const event = await prisma.cpaOfferConversion.create({
    data: {
      offerId: input.offerId,
      clickId: input.attribution.attributedClickId ?? undefined,
      advertiserId: input.attribution.advertiserId ?? undefined,
      clickRecordId: input.attribution.clickRecordId ?? undefined,
      payout: effectivePayout ?? undefined,
      rawQuery: input.rawPayload,
    },
  });

  if (input.attribution.advertiserId) {
    const earningAmount = effectivePayout != null ? Number(effectivePayout) : 0;
    if (earningAmount > 0) {
      const availableAt = new Date();
      availableAt.setDate(availableAt.getDate() + 7);

      try {
        await prisma.$transaction(async (tx) => {
          await tx.cpaWallet.upsert({
            where: { advertiserId: input.attribution.advertiserId! },
            create: { advertiserId: input.attribution.advertiserId! },
            update: {},
          });

          await tx.cpaEarning.create({
            data: {
              advertiserId: input.attribution.advertiserId!,
              conversionId: event.id,
              offerId: input.offerId,
              amount: earningAmount,
              availableAt,
              status: "PENDING",
            },
          });
        });

        void notifyAdvertiserCpaSale({
          advertiserId: input.attribution.advertiserId!,
          offerId: input.offerId,
          amount: earningAmount,
          conversionId: event.id,
        });
      } catch (error) {
        console.error("[pbtr] CPA earning creation failed", error);
      }
    }
  }

  try {
    await dispatchCpaConversionPostbacks({
      conversionId: event.id,
      offerId: input.offerId,
      advertiserId: input.attribution.advertiserId,
      clickId: input.attribution.attributedClickId,
      payout: effectivePayout,
      source: input.attribution.source,
      subId: input.attribution.subId,
    });
  } catch (error) {
    console.error("[pbtr] outbound dispatch failed", error);
  }

  return event;
}

/**
 * Network-wide inbound postback: /pbtr?click_id=...&payout=...
 * Offer + advertiser are resolved from the platform click record.
 */
export async function handleGlobalCpaPostback(request: Request) {
  try {
    const { searchParams, body, getParam } = await readParams(request);

    const network = await getCpaNetworkPostbackConfig();
    if (!isPostbackSecurityAuthorized(network, getParam("secure"))) {
      return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const inboundClickId = resolveInboundClickId(getParam);
    if (!inboundClickId) {
      return clickIdFailureResponse(getParam, false);
    }

    const clickRow = await loadClick(inboundClickId);
    if (!clickRow) {
      return clickIdFailureResponse(getParam, false);
    }

    const offer = await prisma.cpaOffer.findUnique({
      where: { id: clickRow.offerId },
      select: { id: true, status: true },
    });
    if (!offer || offer.status === "ARCHIVED") {
      return clickIdFailureResponse(getParam, false);
    }

    const attribution = resolveCpaClickAttribution({
      offerId: offer.id,
      inboundClickId,
      click: clickRow,
    });

    const payout = parsePayout(getParam("payout"));

    const rawQuery: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawQuery[key] = value;
    });
    const rawPayload: Prisma.InputJsonValue =
      Object.keys(rawQuery).length > 0 ? rawQuery : (body as Prisma.InputJsonValue);

    const event = await createConversionAndDispatch({
      offerId: offer.id,
      attribution,
      payout,
      rawPayload,
    });

    return Response.json({
      ok: true,
      id: event.id,
      clickId: attribution.attributedClickId,
      attributed: Boolean(attribution.advertiserId),
    });
  } catch (error) {
    console.error("[pbtr] global postback failed", error);
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * Legacy per-offer inbound postback: /pbtr/{token}?click_id=...&payout=...
 * Kept for backward compatibility; new integrations should use the global URL.
 */
export async function handleLegacyTokenCpaPostback(request: Request, token: string) {
  try {
    const offer = await prisma.cpaOffer.findUnique({
      where: { postbackToken: token },
      select: { id: true, status: true },
    });

    if (!offer || offer.status === "ARCHIVED") {
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const { searchParams, body, getParam } = await readParams(request);

    const network = await getCpaNetworkPostbackConfig();
    if (!isPostbackSecurityAuthorized(network, getParam("secure"))) {
      return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const inboundClickId = resolveInboundClickId(getParam);
    const clickRow = await loadClick(inboundClickId);
    const attribution = resolveCpaClickAttribution({
      offerId: offer.id,
      inboundClickId,
      click: clickRow,
    });

    const payout = parsePayout(getParam("payout"));

    const rawQuery: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      rawQuery[key] = value;
    });
    const rawPayload: Prisma.InputJsonValue =
      Object.keys(rawQuery).length > 0 ? rawQuery : (body as Prisma.InputJsonValue);

    const event = await createConversionAndDispatch({
      offerId: offer.id,
      attribution,
      payout,
      rawPayload,
    });

    return Response.json({
      ok: true,
      id: event.id,
      clickId: attribution.attributedClickId,
      attributed: Boolean(attribution.advertiserId),
    });
  } catch (error) {
    console.error("[pbtr] token postback failed", error);
    return Response.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}
