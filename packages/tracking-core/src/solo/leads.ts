import { prisma } from "@cpl/database";
import { isWithinAttributionWindow } from "./attribution";
import { hashEmail, isSoloClickId, sha256Hex } from "./ids";
import { localDate } from "./pacing";
import { bumpSoloStats, isUniqueViolation, loadSoloAdsConfig } from "./store";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HOST_FRESH_MS = 60 * 60 * 1000;

export type SoloLeadResult =
  | { ok: true; status: "VALID" | "DUPLICATE"; leadId: string | null }
  | { ok: false; reason: string };

/**
 * Record an opt-in for a Solo click. The click must belong to this affiliate's
 * campaign and be inside the attribution window; one lead per click + email.
 */
export async function recordSoloLead(input: {
  publisherId: string;
  soloClickId: string;
  email: string | null;
  source: "SCRIPT" | "API";
  eventKey?: string | null;
  at?: Date;
}): Promise<SoloLeadResult> {
  if (!isSoloClickId(input.soloClickId)) return { ok: false, reason: "invalid_click_id" };
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !EMAIL_PATTERN.test(email)) return { ok: false, reason: "invalid_email" };

  const click = await prisma.soloClick.findUnique({
    where: { id: input.soloClickId },
    select: {
      id: true,
      campaignId: true,
      providerId: true,
      publisherId: true,
      billingStatus: true,
      createdAt: true,
      campaign: { select: { timezone: true } },
    },
  });
  if (!click?.campaignId || !click.campaign) return { ok: false, reason: "unknown_click" };
  if (click.publisherId !== input.publisherId) return { ok: false, reason: "wrong_affiliate" };
  if (click.billingStatus === "INVALID" || click.billingStatus === "FALLBACK") return { ok: false, reason: "invalid_click" };

  const at = input.at ?? new Date();
  const config = await loadSoloAdsConfig();
  if (!isWithinAttributionWindow(click.createdAt, at, config.attributionWindowDays)) return { ok: false, reason: "expired" };

  const emailHash = email ? hashEmail(email) : null;
  const eventKey = sha256Hex(
    `${input.publisherId}:${input.eventKey?.trim() || `${click.id}:${emailHash ?? "anon"}`}`,
  );
  const duplicate = emailHash
    ? await prisma.soloLeadEvent.findFirst({
        where: { campaignId: click.campaignId, emailHash, status: "VALID" },
        select: { id: true },
      })
    : await prisma.soloLeadEvent.findFirst({ where: { soloClickId: click.id, status: "VALID" }, select: { id: true } });
  const status = duplicate ? "DUPLICATE" : "VALID";

  try {
    const lead = await prisma.$transaction(async (tx) => {
      const row = await tx.soloLeadEvent.create({
        data: {
          eventKey,
          publisherId: input.publisherId,
          soloClickId: click.id,
          campaignId: click.campaignId!,
          source: input.source,
          emailHash,
          status,
          reason: duplicate ? "repeat_email" : null,
        },
        select: { id: true },
      });
      if (status === "VALID") {
        await bumpSoloStats(
          tx,
          { campaignId: click.campaignId!, providerId: click.providerId, localDate: localDate(at, click.campaign!.timezone) },
          { leads: 1 },
        );
      }
      return row;
    });
    return { ok: true, status, leadId: lead.id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: true, status: "DUPLICATE", leadId: null };
    throw error;
  }
}

/**
 * Heartbeat from the global script: remember the host and mark matching
 * external campaigns as tracking-verified. Cheap when called repeatedly.
 */
export async function recordSoloScriptPing(siteKey: string, host: string, at = new Date()) {
  const cleanHost = host.trim().toLowerCase().replace(/\.$/, "");
  if (!cleanHost || cleanHost.length > 191 || !/^[a-z0-9.-]+$/.test(cleanHost)) return { ok: false as const, reason: "bad_host" };
  const site = await prisma.soloTrackingSite.findUnique({
    where: { siteKey },
    select: { id: true, publisherId: true, hosts: { where: { host: cleanHost }, select: { id: true, lastSeenAt: true } } },
  });
  if (!site) return { ok: false as const, reason: "unknown_site" };

  const known = site.hosts[0];
  if (known && at.getTime() - known.lastSeenAt.getTime() < HOST_FRESH_MS) {
    return { ok: true as const, publisherId: site.publisherId, refreshed: false };
  }
  try {
    await prisma.soloTrackingHost.upsert({
      where: { siteId_host: { siteId: site.id, host: cleanHost } },
      create: { siteId: site.id, host: cleanHost, firstSeenAt: at, lastSeenAt: at },
      update: { lastSeenAt: at },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await prisma.soloTrackingSite.update({ where: { id: site.id }, data: { lastSeenAt: at } });
  await prisma.soloCampaign.updateMany({
    where: {
      publisherId: site.publisherId,
      destinationMode: "EXTERNAL",
      destinationHost: cleanHost,
      trackingVerifiedAt: null,
    },
    data: { trackingVerifiedAt: at },
  });
  return { ok: true as const, publisherId: site.publisherId, refreshed: true };
}
