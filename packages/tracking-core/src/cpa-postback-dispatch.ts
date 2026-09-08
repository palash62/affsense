import { prisma } from "@cpl/database";
import type { CpaPostbackDeliveryTarget, Prisma } from "@prisma/client";
import {
  substitutePostbackMacros,
  type PostbackMacroContext,
} from "./postback-macros";
import { assertSafeOutboundUrl } from "./safe-outbound-url";

const CPA_NETWORK_POSTBACK_SETTINGS_KEY = "cpa_network_postback";
const FETCH_TIMEOUT_MS = 4_000;
const RESPONSE_TRUNCATE = 500;

type NetworkConfig = {
  useSecurityKey: boolean;
  securityKey: string;
  parallelPostbackUrl: string;
};

function parseNetworkConfig(value: unknown): NetworkConfig {
  if (!value || typeof value !== "object") {
    return { useSecurityKey: false, securityKey: "", parallelPostbackUrl: "" };
  }
  const raw = value as Record<string, unknown>;
  return {
    useSecurityKey: Boolean(raw.useSecurityKey),
    securityKey: typeof raw.securityKey === "string" ? raw.securityKey.trim() : "",
    parallelPostbackUrl:
      typeof raw.parallelPostbackUrl === "string" ? raw.parallelPostbackUrl.trim() : "",
  };
}

export async function getCpaNetworkPostbackConfig(): Promise<NetworkConfig> {
  const row = await prisma.platformSetting.findUnique({
    where: { key: CPA_NETWORK_POSTBACK_SETTINGS_KEY },
  });
  return parseNetworkConfig(row?.value);
}

/** Pure helper for tests: security key gate. */
export function isPostbackSecurityAuthorized(
  config: Pick<NetworkConfig, "useSecurityKey" | "securityKey">,
  secureParam: string | null | undefined,
): boolean {
  if (!config.useSecurityKey) return true;
  if (!config.securityKey) return false;
  return secureParam === config.securityKey;
}

async function recordDelivery(input: {
  conversionId: string;
  target: CpaPostbackDeliveryTarget;
  url: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  httpStatus?: number | null;
  error?: string | null;
}) {
  try {
    await prisma.cpaPostbackDelivery.upsert({
      where: {
        conversionId_target: {
          conversionId: input.conversionId,
          target: input.target,
        },
      },
      create: {
        conversionId: input.conversionId,
        target: input.target,
        url: input.url.slice(0, 4000),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
        attempts: 1,
      },
      update: {
        url: input.url.slice(0, 4000),
        status: input.status,
        httpStatus: input.httpStatus ?? null,
        error: input.error?.slice(0, RESPONSE_TRUNCATE) ?? null,
        attempts: { increment: 1 },
      },
    });
  } catch (error) {
    console.error("[cpa-postback] failed to record delivery", input.target, error);
  }
}

async function fireHttpGet(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const safe = await assertSafeOutboundUrl(url);
    const res = await fetch(safe.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "LeadVix-CPA-Postback/1.0" },
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status };
    }
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      error: body.slice(0, RESPONSE_TRUNCATE) || `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "Request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function dispatchAdminParallel(
  conversionId: string,
  parallelPostbackUrl: string,
  macroContext: PostbackMacroContext,
) {
  const url = substitutePostbackMacros(parallelPostbackUrl, macroContext);
  try {
    const result = await fireHttpGet(url);
    await recordDelivery({
      conversionId,
      target: "ADMIN_PARALLEL",
      url,
      status: result.ok ? "SUCCESS" : "FAILED",
      httpStatus: result.status || null,
      error: result.error ?? null,
    });
  } catch (error) {
    await recordDelivery({
      conversionId,
      target: "ADMIN_PARALLEL",
      url,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Dispatch failed",
    });
  }
}

async function dispatchAdvertiserGlobal(
  conversionId: string,
  advertiserId: string,
  macroContext: PostbackMacroContext,
) {
  try {
    const global = await prisma.advertiserGlobalPostback.findUnique({
      where: { advertiserId },
    });

    if (!global || global.status !== "ACTIVE" || !global.endpoint.trim()) {
      return;
    }

    if (global.type === "HTML") {
      await recordDelivery({
        conversionId,
        target: "ADVERTISER_GLOBAL",
        url: "[html-snippet]",
        status: "SKIPPED",
        error:
          "HTML/Javascript postbacks are stored for advertiser use and are not server-fired.",
      });
      return;
    }

    const url = substitutePostbackMacros(global.endpoint, macroContext);
    const result = await fireHttpGet(url);
    await recordDelivery({
      conversionId,
      target: "ADVERTISER_GLOBAL",
      url,
      status: result.ok ? "SUCCESS" : "FAILED",
      httpStatus: result.status || null,
      error: result.error ?? null,
    });
  } catch (error) {
    await recordDelivery({
      conversionId,
      target: "ADVERTISER_GLOBAL",
      url: "",
      status: "FAILED",
      error: error instanceof Error ? error.message : "Dispatch failed",
    });
  }
}

async function dispatchPublisherGlobal(
  conversionId: string,
  publisherId: string,
  macroContext: PostbackMacroContext,
) {
  try {
    const global = await prisma.publisherPostback.findUnique({
      where: {
        publisherId_channel: {
          publisherId,
          channel: "CPA",
        },
      },
    });

    if (!global || global.status !== "ACTIVE" || !global.endpoint.trim()) {
      return;
    }

    const publisherMacros: PostbackMacroContext = {
      ...macroContext,
      affId: publisherId,
      affEid: publisherId,
      leadId: conversionId,
    };

    const url = substitutePostbackMacros(global.endpoint, publisherMacros);
    const result = await fireHttpGet(url);
    await recordDelivery({
      conversionId,
      target: "PUBLISHER",
      url,
      status: result.ok ? "SUCCESS" : "FAILED",
      httpStatus: result.status || null,
      error: result.error ?? null,
    });
  } catch (error) {
    await recordDelivery({
      conversionId,
      target: "PUBLISHER",
      url: "",
      status: "FAILED",
      error: error instanceof Error ? error.message : "Dispatch failed",
    });
  }
}

export async function dispatchCpaConversionPostbacks(input: {
  conversionId: string;
  offerId: string;
  advertiserId: string | null;
  publisherId?: string | null;
  clickId: string | null;
  payout: Prisma.Decimal | number | string | null;
  source?: string | null;
  subId?: string | null;
}) {
  const macroContext: PostbackMacroContext = {
    clickId: input.clickId,
    payout: input.payout != null ? String(input.payout) : "",
    currency: "USD",
    affId: input.advertiserId,
    offerId: input.offerId,
    source: input.source,
    date: new Date().toISOString().slice(0, 10),
    sub1: input.subId,
  };

  const network = await getCpaNetworkPostbackConfig();

  // Isolate targets: admin failure must not skip advertiser/publisher dispatch.
  if (network.parallelPostbackUrl) {
    await dispatchAdminParallel(
      input.conversionId,
      network.parallelPostbackUrl,
      macroContext,
    );
  }

  if (input.advertiserId) {
    await dispatchAdvertiserGlobal(input.conversionId, input.advertiserId, macroContext);
  }

  if (input.publisherId) {
    await dispatchPublisherGlobal(input.conversionId, input.publisherId, macroContext);
  }
}
