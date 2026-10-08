/**
 * Solo Ads acceptance run against the LOCAL database and tracking dev server.
 * Creates throwaway fixtures, exercises the spec's acceptance tests, and removes
 * everything it created (the solo_ads setting is restored).
 *
 *   cd apps/platform
 *   npx tsx --env-file=.env scripts/solo-ads-acceptance.ts
 *
 * Needs the tracking app on SOLO_QA_TRACKING_URL (default http://127.0.0.1:3001).
 * Spec tests 4-7 and 13 (ClickFunnels product/rebill rules) are covered by
 * tests/unit/clickfunnels-conversion-validation.test.ts.
 */
import { randomUUID } from "node:crypto";
import {
  checkSoloClickLink,
  finalizeDueSoloClicks,
  findSoloCampaignMismatches,
  findSoloWalletMismatches,
  generateSecret,
  generateSoloClickId,
  getCpaNetworkPostbackConfig,
  loadSoloAdsConfig,
  localDate,
  postSoloLedgerEntry,
  recordSoloLead,
  refundSoloClick,
  reserveSoloClick,
  reverseSoloConversion,
  SOLO_ADS_SETTINGS_KEY,
  SoloReservationFailed,
  sweepSoloCampaignStatuses,
} from "@cpl/tracking-core";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { getOwnedSoloCampaign, listSoloCampaignProviders, setSoloProviderBlock, updateSoloCampaign } from "../src/services/solo-campaign.service";

const TRACKING = (process.env.SOLO_QA_TRACKING_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const TAG = `qa-solo-${Date.now()}`;
const FALLBACK = "https://fallback.example.com/";
const CPC = 45;

type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];

async function check(id: string, name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    results.push({ id, name, ok: true, detail: detail || undefined });
    console.log(`PASS ${id} ${name}${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    const cause = (error as { cause?: { code?: string; message?: string } }).cause;
    const message = `${(error as Error).message}${cause ? ` (${cause.code ?? cause.message})` : ""}`;
    results.push({ id, name, ok: false, detail: message });
    console.log(`FAIL ${id} ${name} - ${message}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let ipCounter = 1;
const nextIp = () => `198.51.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

async function hit(pool: "regular" | "warm", token: string, opts: { ip?: string; country?: string; ua?: string } = {}) {
  const res = await fetch(`${TRACKING}/sa/${pool}?token=${encodeURIComponent(token)}`, {
    redirect: "manual",
    headers: {
      "x-forwarded-for": opts.ip ?? nextIp(),
      "cf-ipcountry": opts.country ?? "US",
      "user-agent": opts.ua ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    },
  });
  return { status: res.status, location: res.headers.get("location") ?? "" };
}

async function postback(offerClickId: string, txn: string) {
  const network = await getCpaNetworkPostbackConfig();
  const secure = network.useSecurityKey && network.securityKey ? `&secure=${encodeURIComponent(network.securityKey)}` : "";
  return fetch(`${TRACKING}/pbtr?click_id=${offerClickId}&payout=20&transaction_id=${txn}${secure}`);
}

async function latestClick(tokenId: string) {
  return prisma.soloClick.findFirst({ where: { tokenId }, orderBy: { createdAt: "desc" } });
}

async function fund(publisherId: string, cents: number) {
  const wallet = await prisma.soloWallet.upsert({ where: { publisherId }, create: { publisherId }, update: {} });
  await prisma.$transaction((tx) =>
    postSoloLedgerEntry(tx, {
      walletId: wallet.id,
      type: "ADJUSTMENT",
      amountCents: cents,
      idempotencyKey: `${TAG}:fund:${randomUUID()}`,
      sourceType: "qa",
      reason: "QA funding",
    }),
  );
}

async function setWalletTo(publisherId: string, cents: number) {
  const wallet = await prisma.soloWallet.findUniqueOrThrow({ where: { publisherId } });
  if (wallet.balanceCents !== cents) {
    await prisma.$transaction((tx) =>
      postSoloLedgerEntry(tx, {
        walletId: wallet.id,
        type: "ADJUSTMENT",
        amountCents: cents - wallet.balanceCents,
        idempotencyKey: `${TAG}:set:${randomUUID()}`,
        sourceType: "qa",
        reason: "QA set balance",
      }),
    );
  }
}

async function main() {
  const originalSetting = await prisma.platformSetting.findUnique({ where: { key: SOLO_ADS_SETTINGS_KEY } });
  const created = { users: [] as string[], providers: [] as string[], offers: [] as string[] };

  try {
    // ---------- fixtures ----------
    const pubA = await prisma.user.create({
      data: { email: `${TAG}-a@qa.local`, passwordHash: "x", name: "QA Solo A", role: "PUBLISHER", status: "ACTIVE" },
    });
    const pubB = await prisma.user.create({
      data: { email: `${TAG}-b@qa.local`, passwordHash: "x", name: "QA Solo B", role: "PUBLISHER", status: "ACTIVE" },
    });
    created.users.push(pubA.id, pubB.id);

    await prisma.platformSetting.upsert({
      where: { key: SOLO_ADS_SETTINGS_KEY },
      create: { key: SOLO_ADS_SETTINGS_KEY, value: {} },
      update: {},
    });
    await prisma.platformSetting.update({
      where: { key: SOLO_ADS_SETTINGS_KEY },
      data: {
        value: {
          ...((originalSetting?.value as object) ?? {}),
          enabled: true,
          betaOnly: true,
          betaPublisherIds: [pubA.id, pubB.id],
          regularCpcCents: CPC,
          warmCpcCents: 75,
          supportedCountries: ["US", "GB", "CA"],
          validationDelayMinutes: 0,
          maxClicksPerIpPerHour: 3,
          maxClicksPerTokenPerMinute: 600,
          uniqueVisitorWindowHours: 24,
          blockBots: true,
          fallbackUrl: FALLBACK,
          cpaApprovalDays: 7,
        },
      },
    });

    const offer = await prisma.cpaOffer.create({
      data: {
        name: `${TAG} offer`,
        network: "QA",
        category: "QA",
        previewUrl: "https://example.com/preview",
        trackingUrl: "https://offer.example.com/go?cid={click_id}",
        revenue: new Prisma.Decimal(30),
        payout: new Prisma.Decimal(20),
        postbackToken: `${TAG}-pb`,
        status: "ACTIVE",
        visibility: "PUBLIC",
      },
    });
    created.offers.push(offer.id);

    const maxCode = await prisma.soloProvider.aggregate({ _max: { publicCode: true } });
    const base = Math.max(9000, (maxCode._max.publicCode ?? 0) + 1);
    const p1 = await prisma.soloProvider.create({ data: { publicCode: base, realName: `${TAG} P1`, trafficClass: "BOTH" } });
    const p2 = await prisma.soloProvider.create({ data: { publicCode: base + 1, realName: `${TAG} P2`, trafficClass: "BOTH" } });
    created.providers.push(p1.id, p2.id);
    const issue = async (providerId: string) => {
      const s = generateSecret("spr");
      const row = await prisma.soloProviderToken.create({
        data: { providerId, trafficType: "REGULAR", tokenHash: s.hash, prefix: s.prefix },
      });
      return { token: s.secret, id: row.id };
    };
    const t1 = await issue(p1.id);
    const t2 = await issue(p2.id);

    const campaignBase = {
      offerType: "CPA" as const,
      cpaOfferId: offer.id,
      trafficType: "REGULAR" as const,
      countries: ["US"],
      timezone: "UTC",
      cpcCentsSnapshot: CPC,
      status: "ACTIVE" as const,
    };
    const campA = await prisma.soloCampaign.create({
      data: {
        ...campaignBase,
        publisherId: pubA.id,
        name: `${TAG} A direct`,
        destinationMode: "DIRECT",
        dailyBudgetCents: 100_000,
        lifetimeBudgetCents: 100_000,
      },
    });
    await fund(pubA.id, 10_000);
    await fund(pubB.id, 10_000);

    // ---------- 1. direct campaign: click -> verified CPA sale, exactly one conversion ----------
    let directSoloClickId = "";
    let directOfferClickId = "";
    await check("1", "Direct campaign: provider click leads to one verified CPA sale", async () => {
      const r = await hit("regular", t1.token);
      assert(r.status === 302, `expected 302, got ${r.status}`);
      const click = await latestClick(t1.id);
      assert(click?.campaignId === campA.id && click.billingStatus === "PENDING", `click not routed to A (${click?.billingStatus}/${click?.invalidReason})`);
      const offerClick = await prisma.cpaOfferClick.findFirst({ where: { soloClickId: click.id } });
      assert(offerClick, "offer click not linked to solo click");
      assert(r.location.includes(offerClick.id), "redirect does not carry the offer click id");
      directSoloClickId = click.id;
      directOfferClickId = offerClick.id;

      const pb = await postback(offerClick.id, `${TAG}-txn1`);
      assert(pb.ok, `postback failed ${pb.status}`);
      const again = await postback(offerClick.id, `${TAG}-txn1`);
      assert(again.ok, "duplicate postback errored");
      const conversions = await prisma.soloConversion.findMany({ where: { soloClickId: click.id } });
      assert(conversions.length === 1, `expected 1 solo conversion, got ${conversions.length}`);
      assert(conversions[0].providerId === p1.id && conversions[0].publisherId === pubA.id, "conversion credited to wrong provider/affiliate");
      return `commission ${conversions[0].commissionCents}c, duplicate postback ignored`;
    });

    // ---------- 2 + 3. external opt-in ----------
    const campExt = await prisma.soloCampaign.create({
      data: {
        ...campaignBase,
        publisherId: pubB.id,
        name: `${TAG} B external`,
        destinationMode: "EXTERNAL",
        destinationUrl: "https://optin.example.com/page",
        destinationHost: "optin.example.com",
        trackingVerifiedAt: null,
        dailyBudgetCents: 100_000,
        lifetimeBudgetCents: 100_000,
      },
    });

    await check("3", "External page without verified tracking gets no traffic and no fabricated sale", async () => {
      await prisma.soloCampaign.update({ where: { id: campA.id }, data: { status: "PAUSED" } });
      const r = await hit("regular", t1.token);
      const click = await latestClick(t1.id);
      assert(r.location === FALLBACK && click?.billingStatus === "FALLBACK", `unverified external campaign received traffic (${click?.campaignId})`);
      const plain = await fetch(`${TRACKING}/cpa/${offer.id}?pub_id=${pubB.id}`, { redirect: "manual" });
      assert(plain.status === 302, "offer click failed");
      const offerClick = await prisma.cpaOfferClick.findFirst({ where: { offerId: offer.id, publisherId: pubB.id }, orderBy: { createdAt: "desc" } });
      assert(offerClick && !offerClick.soloClickId, "offer click without affs_click_id was linked to Solo Ads");
      return "fallback, unlinked offer click";
    });

    await check("2", "External opt-in: click id survives landing page and the sale lands on the original provider", async () => {
      await prisma.soloCampaign.update({ where: { id: campExt.id }, data: { trackingVerifiedAt: new Date() } });
      const r = await hit("regular", t2.token);
      const url = new URL(r.location);
      const sc = url.searchParams.get("affs_click_id");
      assert(url.host === "optin.example.com" && sc, `landing redirect missing affs_click_id: ${r.location}`);
      const cta = await fetch(`${TRACKING}/cpa/${offer.id}?pub_id=${pubB.id}&affs_click_id=${sc}`, { redirect: "manual" });
      assert(cta.status === 302, `CTA failed ${cta.status}`);
      const offerClick = await prisma.cpaOfferClick.findFirst({ where: { soloClickId: sc } });
      assert(offerClick, "CTA click not linked");
      const repeat = await fetch(`${TRACKING}/cpa/${offer.id}?pub_id=${pubB.id}&affs_click_id=${sc}`, { redirect: "manual" });
      assert(repeat.status === 302, "repeat CTA failed");
      assert((await prisma.cpaOfferClick.count({ where: { soloClickId: sc } })) === 1, "repeat CTA created a second linked click");
      const lead = await recordSoloLead({ publisherId: pubB.id, soloClickId: sc, email: `${TAG}@lead.local`, source: "SCRIPT" });
      assert(lead.ok, `lead rejected: ${JSON.stringify(lead)}`);
      const pb = await postback(offerClick.id, `${TAG}-txn2`);
      assert(pb.ok, "postback failed");
      const conv = await prisma.soloConversion.findFirst({ where: { soloClickId: sc } });
      assert(conv?.providerId === p2.id && conv.campaignId === campExt.id, "sale not credited to original provider/campaign");
      return "lead + sale attributed to provider P2";
    });
    await prisma.soloCampaign.update({ where: { id: campExt.id }, data: { status: "PAUSED" } });
    await prisma.soloCampaign.update({ where: { id: campA.id }, data: { status: "ACTIVE" } });

    // ---------- 9. provider block ----------
    const campB = await prisma.soloCampaign.create({
      data: { ...campaignBase, publisherId: pubB.id, name: `${TAG} B direct`, destinationMode: "DIRECT", dailyBudgetCents: 100_000, lifetimeBudgetCents: 100_000 },
    });
    await check("9", "Blocked provider on campaign A: no more A deliveries, campaign B unaffected", async () => {
      await setSoloProviderBlock(pubA.id, campA.id, p1.publicCode, true);
      const seen = new Set<string | null>();
      for (let i = 0; i < 6; i++) {
        await hit("regular", t1.token);
        seen.add((await latestClick(t1.id))?.campaignId ?? null);
      }
      assert(!seen.has(campA.id), "blocked provider still delivered to A");
      assert(seen.has(campB.id), "campaign B stopped receiving the provider's traffic");
      await setSoloProviderBlock(pubA.id, campA.id, p1.publicCode, false);
      return "6 clicks, all to B";
    });

    // ---------- 10. fallback never charged ----------
    await check("10", "No eligible campaign: fallback traffic is never charged", async () => {
      await prisma.soloCampaign.updateMany({ where: { id: { in: [campA.id, campB.id] } }, data: { status: "PAUSED" } });
      const before = await prisma.soloWalletLedger.count({ where: { type: "CHARGE", wallet: { publisherId: { in: [pubA.id, pubB.id] } } } });
      const r = await hit("regular", t1.token);
      const click = await latestClick(t1.id);
      assert(r.location === FALLBACK && click?.billingStatus === "FALLBACK" && click.chargeCents === 0, "fallback click is billable");
      await finalizeDueSoloClicks(await loadSoloAdsConfig());
      const after = await prisma.soloWalletLedger.count({ where: { type: "CHARGE", wallet: { publisherId: { in: [pubA.id, pubB.id] } } } });
      const fb = await prisma.soloClick.findUniqueOrThrow({ where: { id: click.id } });
      assert(fb.billingStatus === "FALLBACK", "fallback click changed status at finalize");
      return `charges before ${before}, after finalize ${after} (only pending routed clicks billed)`;
    });
    await prisma.soloCampaign.updateMany({ where: { id: { in: [campA.id, campB.id] } }, data: { status: "ACTIVE" } });

    // ---------- 11. wrong geo / bot / duplicate ----------
    await check("11", "Wrong geo, bots and repeat IPs are filtered and not charged; admin refund works", async () => {
      await hit("regular", t1.token, { country: "RU" });
      const geo = await latestClick(t1.id);
      assert(geo?.billingStatus === "INVALID" && geo.invalidReason === "unsupported_geo", `geo: ${geo?.invalidReason}`);
      await hit("regular", t1.token, { ua: "Googlebot/2.1 (+http://www.google.com/bot.html)" });
      const bot = await latestClick(t1.id);
      assert(bot?.billingStatus === "INVALID" && bot.invalidReason === "bot", `bot: ${bot?.invalidReason}`);
      const ip = nextIp();
      const outcomes: string[] = [];
      for (let i = 0; i < 4; i++) {
        await hit("regular", t1.token, { ip });
        const c = await latestClick(t1.id);
        outcomes.push(`${c?.billingStatus}${c?.invalidReason ? `:${c.invalidReason}` : ""}${c?.campaignId ? `@${c.campaignId === campA.id ? "A" : "B"}` : ""}`);
      }
      const routedTo = outcomes.filter((o) => o.includes("@")).map((o) => o.split("@")[1]);
      assert(new Set(routedTo).size === routedTo.length, `same visitor routed to one campaign twice: ${outcomes.join(", ")}`);
      assert(outcomes[3].includes("ip_rate"), `4th click from one IP not filtered: ${outcomes.join(", ")}`);

      await finalizeDueSoloClicks(await loadSoloAdsConfig());
      const billed = await prisma.soloClick.findFirst({ where: { campaignId: campA.id, billingStatus: "BILLED" } });
      assert(billed, "no billed click to refund");
      const walletBefore = await prisma.soloWallet.findUniqueOrThrow({ where: { publisherId: pubA.id } });
      await refundSoloClick(billed.id, { actorId: pubA.id, reason: "QA refund" });
      await refundSoloClick(billed.id, { actorId: pubA.id, reason: "QA refund again" });
      const walletAfter = await prisma.soloWallet.findUniqueOrThrow({ where: { publisherId: pubA.id } });
      assert(walletAfter.balanceCents === walletBefore.balanceCents + billed.chargeCents, "refund amount wrong or applied twice");
      return outcomes.join(", ");
    });

    // ---------- 8. concurrency ----------
    await check("8", "Parallel clicks against a nearly empty wallet never overspend", async () => {
      await finalizeDueSoloClicks(await loadSoloAdsConfig());
      await prisma.soloCampaign.update({ where: { id: campB.id }, data: { status: "PAUSED" } });
      await setWalletTo(pubA.id, CPC * 3 + 10);
      const responses = await Promise.all(Array.from({ length: 20 }, () => hit("regular", t2.token)));
      assert(responses.every((r) => r.status === 302), "some requests failed");
      const wallet = await prisma.soloWallet.findUniqueOrThrow({ where: { publisherId: pubA.id } });
      const pending = await prisma.soloClick.count({ where: { campaignId: campA.id, billingStatus: "PENDING" } });
      assert(pending <= 3, `reserved ${pending} clicks for a 3-click wallet`);
      assert(wallet.reservedCents <= wallet.balanceCents, "reserved more than the balance");

      // Direct reservations with a lifetime cap, 40 at once.
      const cap = await prisma.soloCampaign.create({
        data: { ...campaignBase, publisherId: pubB.id, name: `${TAG} cap`, destinationMode: "DIRECT", dailyBudgetCents: 100_000, lifetimeBudgetCents: CPC * 5 },
      });
      const at = new Date();
      const settled = await Promise.allSettled(
        Array.from({ length: 40 }, () =>
          prisma.$transaction((tx) =>
            reserveSoloClick(tx, {
              campaignId: cap.id,
              publisherId: pubB.id,
              providerId: p2.id,
              providerDailyCapacity: null,
              cpcCents: CPC,
              dailyBudgetCents: 100_000,
              localDate: localDate(at, "UTC"),
              at,
            }),
          ),
        ),
      );
      const ok = settled.filter((s) => s.status === "fulfilled").length;
      const unexpected = settled.filter((s) => s.status === "rejected" && !(s.reason instanceof SoloReservationFailed));
      const capRow = await prisma.soloCampaign.findUniqueOrThrow({ where: { id: cap.id } });
      assert(ok === 5 && capRow.reservedCents === CPC * 5, `lifetime cap 5 clicks, reserved ${ok} (${capRow.reservedCents}c)`);
      assert(unexpected.length === 0, `unexpected errors: ${unexpected.map((u) => (u as PromiseRejectedResult).reason?.message).join("; ")}`);
      await prisma.$executeRaw`UPDATE solo_wallets SET reserved_cents = reserved_cents - ${CPC * 5} WHERE publisher_id = ${pubB.id}`;
      await prisma.soloCampaign.delete({ where: { id: cap.id } });
      await prisma.soloCampaign.update({ where: { id: campB.id }, data: { status: "ACTIVE" } });
      return `HTTP: ${pending} of 20 reserved; direct: ${ok} of 40 reserved`;
    });

    // ---------- 12. forged / expired / wrong affiliate ----------
    await check("12", "Forged, expired, wrong-affiliate and wrong-offer click ids are rejected", async () => {
      const click = await prisma.soloClick.findUniqueOrThrow({ where: { id: directSoloClickId } });
      const now = new Date();
      const base = { click, publisherId: pubA.id, offerType: "CPA" as const, offerId: offer.id, at: now, windowDays: 30 };
      assert(checkSoloClickLink(base).ok, "valid click rejected");
      assert(!checkSoloClickLink({ ...base, click: null }).ok, "forged id accepted");
      assert(!checkSoloClickLink({ ...base, publisherId: pubB.id }).ok, "wrong affiliate accepted");
      assert(!checkSoloClickLink({ ...base, offerId: "other-offer" }).ok, "wrong offer accepted");
      assert(!checkSoloClickLink({ ...base, at: new Date(now.getTime() + 31 * 86_400_000) }).ok, "expired click accepted");
      const forged = generateSoloClickId();
      await fetch(`${TRACKING}/cpa/${offer.id}?pub_id=${pubB.id}&affs_click_id=${directSoloClickId}`, { redirect: "manual" });
      await fetch(`${TRACKING}/cpa/${offer.id}?pub_id=${pubA.id}&affs_click_id=${forged}`, { redirect: "manual" });
      const linked = await prisma.cpaOfferClick.count({ where: { soloClickId: { in: [forged] } } });
      const stolen = await prisma.cpaOfferClick.count({ where: { soloClickId: directSoloClickId, publisherId: pubB.id } });
      assert(linked === 0 && stolen === 0, "tracker linked a forged or foreign click id");
      const lead = await recordSoloLead({ publisherId: pubB.id, soloClickId: directSoloClickId, email: "x@y.local", source: "API" });
      assert(!lead.ok, "lead accepted for another affiliate's click");
      return "pure checks + tracker + lead API";
    });

    // ---------- 14. refund / chargeback reversal ----------
    await check("14", "Sale reversal updates commission/ROI and keeps history", async () => {
      const conv = await prisma.soloConversion.findFirstOrThrow({ where: { soloClickId: directSoloClickId } });
      await reverseSoloConversion(conv.id, "chargeback");
      await reverseSoloConversion(conv.id, "chargeback again");
      const after = await prisma.soloConversion.findUniqueOrThrow({ where: { id: conv.id } });
      const stats = await prisma.soloDailyStats.aggregate({ where: { campaignId: campA.id }, _sum: { commissionCents: true, reversedCents: true } });
      assert(after.status === "REVERSED" && after.reversedAt, "conversion not marked reversed");
      assert(stats._sum.reversedCents === conv.commissionCents, `reversed ${stats._sum.reversedCents} vs ${conv.commissionCents}`);
      assert((await prisma.cpaOfferClick.count({ where: { id: directOfferClickId } })) === 1, "history deleted");
      return `net commission now ${(stats._sum.commissionCents ?? 0) - (stats._sum.reversedCents ?? 0)}c`;
    });

    // ---------- 15. IDOR ----------
    await check("15", "Another affiliate's campaign: 403 on read, providers and block", async () => {
      const attempts = [
        () => getOwnedSoloCampaign(pubB.id, campA.id),
        () => listSoloCampaignProviders(pubB.id, campA.id),
        () => setSoloProviderBlock(pubB.id, campA.id, p1.publicCode, true),
        () => updateSoloCampaign(pubB.id, campA.id, { name: "hijack" }),
      ];
      for (const attempt of attempts) {
        const outcome = await attempt().then(
          () => "allowed",
          (e: { status?: number; statusCode?: number }) => String(e.status ?? e.statusCode),
        );
        assert(outcome === "403", `expected 403, got ${outcome}`);
      }
      const row = await prisma.soloCampaign.findUniqueOrThrow({ where: { id: campA.id } });
      assert(row.name !== "hijack" && (await prisma.soloCampaignProviderBlock.count({ where: { campaignId: campA.id } })) === 0, "data changed");
      return "4 attempts rejected";
    });

    // ---------- 16. material change returns to review ----------
    await check("16", "Material change sends an active campaign back to review before serving traffic", async () => {
      await updateSoloCampaign(pubA.id, campA.id, { countries: ["US", "GB"] });
      const row = await prisma.soloCampaign.findUniqueOrThrow({ where: { id: campA.id } });
      assert(row.status === "PENDING_REVIEW", `status ${row.status}`);
      await prisma.soloCampaign.update({ where: { id: campB.id }, data: { status: "PAUSED" } });
      await hit("regular", t1.token);
      const click = await latestClick(t1.id);
      assert(click?.campaignId !== campA.id, "campaign under review still received traffic");
      await prisma.soloCampaign.update({ where: { id: campA.id }, data: { status: "ACTIVE", countries: ["US"] } });
      await prisma.soloCampaign.update({ where: { id: campB.id }, data: { status: "ACTIVE" } });
      return "PENDING_REVIEW, no traffic";
    });

    // ---------- 17. timezone boundary ----------
    await check("17", "Daily cap resets exactly once at the campaign's local midnight", async () => {
      const tz = "America/New_York";
      const camp = await prisma.soloCampaign.create({
        data: { ...campaignBase, publisherId: pubB.id, name: `${TAG} tz`, destinationMode: "DIRECT", timezone: tz, dailyBudgetCents: CPC, lifetimeBudgetCents: CPC * 10 },
      });
      const lateNight = new Date("2026-03-07T04:59:00Z"); // 23:59 New York
      const sameNight = new Date("2026-03-07T04:59:40Z");
      const afterMidnight = new Date("2026-03-07T05:00:30Z"); // 00:00:30 New York
      const reserve = (at: Date) =>
        prisma
          .$transaction((tx) =>
            reserveSoloClick(tx, {
              campaignId: camp.id,
              publisherId: pubB.id,
              providerId: p2.id,
              providerDailyCapacity: null,
              cpcCents: CPC,
              dailyBudgetCents: CPC,
              localDate: localDate(at, tz),
              at,
            }),
          )
          .then(() => "ok", (e: Error) => (e instanceof SoloReservationFailed ? e.reason : e.message));
      const outcomes = [await reserve(lateNight), await reserve(sameNight), await reserve(afterMidnight), await reserve(afterMidnight)];
      await prisma.$executeRaw`UPDATE solo_wallets SET reserved_cents = reserved_cents - ${CPC * 2} WHERE publisher_id = ${pubB.id}`;
      await prisma.soloCampaign.delete({ where: { id: camp.id } });
      assert(outcomes.join(",") === "ok,daily_budget,ok,daily_budget", outcomes.join(","));
      return `${localDate(lateNight, tz)} then ${localDate(afterMidnight, tz)}`;
    });

    // ---------- 18. revoked token ----------
    await check("18", "Revoked provider token: traffic goes to non-billable fallback", async () => {
      await prisma.soloProviderToken.update({ where: { id: t2.id }, data: { status: "REVOKED", revokedAt: new Date() } });
      const before = await prisma.soloClick.count({ where: { tokenId: t2.id } });
      const r = await hit("regular", t2.token);
      const after = await prisma.soloClick.count({ where: { tokenId: t2.id } });
      assert(r.location === FALLBACK && after === before, "revoked token still created clicks");
      const forged = await hit("regular", "spr_forged_token_value_1234567890");
      assert(forged.location === FALLBACK, "forged token routed");
      return "fallback, no click recorded";
    });

    // ---------- money integrity after everything ----------
    await check("R", "Billing, sweep and reconciliation stay consistent", async () => {
      const config = await loadSoloAdsConfig();
      const fin = await finalizeDueSoloClicks(config);
      await setWalletTo(pubA.id, 10);
      const changes = await sweepSoloCampaignStatuses();
      assert(changes.some((c) => c.campaignId === campA.id && c.to === "INSUFFICIENT_FUNDS"), "empty wallet did not pause campaign A");
      await fund(pubA.id, 5_000);
      const resumed = await sweepSoloCampaignStatuses();
      assert(resumed.some((c) => c.campaignId === campA.id && c.to === "ACTIVE"), "funded campaign did not resume");
      const wallets = (await findSoloWalletMismatches()).filter((m) => [pubA.id, pubB.id].includes(m.publisherId));
      const campaigns = (await findSoloCampaignMismatches()).filter((m) => [pubA.id, pubB.id].includes(m.publisherId));
      assert(wallets.length === 0, `wallet mismatches ${JSON.stringify(wallets)}`);
      assert(campaigns.length === 0, `campaign mismatches ${JSON.stringify(campaigns)}`);
      const neg = await prisma.soloWallet.count({ where: { publisherId: { in: [pubA.id, pubB.id] }, balanceCents: { lt: 0 } } });
      assert(neg === 0, "negative wallet");
      return `finalized ${fin.processed} (${fin.billed} billed, ${fin.invalid} invalid); ledgers reconcile`;
    });
  } finally {
    // ---------- cleanup ----------
    const providerIds = created.providers;
    const userIds = created.users;
    const campaignIds = (await prisma.soloCampaign.findMany({ where: { publisherId: { in: userIds } }, select: { id: true } })).map((c) => c.id);
    await prisma.soloConversion.deleteMany({ where: { OR: [{ campaignId: { in: campaignIds } }, { providerId: { in: providerIds } }] } });
    await prisma.soloLeadEvent.deleteMany({ where: { publisherId: { in: userIds } } });
    await prisma.cpaOfferConversion.deleteMany({ where: { offerId: { in: created.offers } } });
    await prisma.cpaOfferClick.deleteMany({ where: { offerId: { in: created.offers } } });
    await prisma.soloClick.deleteMany({ where: { providerId: { in: providerIds } } });
    await prisma.soloCampaign.deleteMany({ where: { id: { in: campaignIds } } });
    const walletIds = (await prisma.soloWallet.findMany({ where: { publisherId: { in: userIds } }, select: { id: true } })).map((w) => w.id);
    await prisma.soloWalletLedger.deleteMany({ where: { walletId: { in: walletIds } } });
    await prisma.soloWallet.deleteMany({ where: { id: { in: walletIds } } });
    await prisma.soloProvider.deleteMany({ where: { id: { in: providerIds } } });
    await prisma.cpaOffer.deleteMany({ where: { id: { in: created.offers } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (originalSetting) {
      await prisma.platformSetting.update({ where: { key: SOLO_ADS_SETTINGS_KEY }, data: { value: originalSetting.value as Prisma.InputJsonValue } });
    } else {
      await prisma.platformSetting.deleteMany({ where: { key: SOLO_ADS_SETTINGS_KEY } });
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
