import {
  approveMaturedSoloConversions,
  findLowSoloWallets,
  findSoloCampaignMismatches,
  findSoloWalletMismatches,
  finalizeDueSoloClicks,
  formatCents,
  loadSoloAdsConfig,
  sweepSoloCampaignStatuses,
  type SoloStatusChange,
} from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";
import { notifyAdminAlert, notifyUserById } from "@/services/notify.service";

export const SOLO_JOBS = ["finalize-clicks", "status-sweep", "approve-conversions", "low-balance", "reconcile"] as const;
export type SoloJobName = (typeof SOLO_JOBS)[number] | "all";

const LOW_BALANCE_TYPE = "solo.wallet.low_balance";
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RECONCILE_ALERT_KEY = "solo_ads_reconcile_alerted_at";

const STATUS_NOTICES: Record<Exclude<SoloStatusChange["to"], "ACTIVE">, { type: string; title: string; message: string; action: string; label: string }> = {
  COMPLETED: {
    type: "solo.campaign.completed",
    title: "Solo Ads campaign finished",
    message: "has reached its end date and stopped receiving traffic.",
    action: "campaign",
    label: "View results",
  },
  BUDGET_EXHAUSTED: {
    type: "solo.campaign.budget_exhausted",
    title: "Solo Ads campaign budget spent",
    message: "has spent its total budget. Raise the budget to keep receiving clicks.",
    action: "campaign",
    label: "Edit campaign",
  },
  INSUFFICIENT_FUNDS: {
    type: "solo.campaign.insufficient_funds",
    title: "Solo Ads campaign paused: add funds",
    message: "is paused because your ad wallet is empty. It resumes automatically when you add funds.",
    action: "wallet",
    label: "Add funds",
  },
};

export async function notifySoloStatusChanges(changes: SoloStatusChange[]) {
  for (const change of changes) {
    if (change.to === "ACTIVE") continue;
    const notice = STATUS_NOTICES[change.to];
    await notifyUserById(change.publisherId, {
      title: notice.title,
      message: `Your campaign "${change.name}" ${notice.message}`,
      actionPath: notice.action === "wallet" ? "/publisher/solo-ads/wallet" : `/publisher/solo-ads/campaigns/${change.campaignId}`,
      actionLabel: notice.label,
      notificationType: notice.type,
    }).catch((error) => console.error("[solo] status notify failed", error));
  }
}

async function runLowBalanceAlerts(thresholdCents: number, now: Date) {
  const wallets = await findLowSoloWallets(thresholdCents);
  let sent = 0;
  for (const w of wallets) {
    const recent = await prisma.notification.findFirst({
      where: { userId: w.publisherId, type: LOW_BALANCE_TYPE, createdAt: { gte: new Date(now.getTime() - ALERT_COOLDOWN_MS) } },
      select: { id: true },
    });
    if (recent) continue;
    await notifyUserById(w.publisherId, {
      title: "Your Solo Ads wallet is running low",
      message: `Only ${formatCents(Math.max(0, Number(w.availableCents)))} is left to spend. Active campaigns pause automatically when funds run out.`,
      actionPath: "/publisher/solo-ads/wallet",
      actionLabel: "Add funds",
      notificationType: LOW_BALANCE_TYPE,
    }).catch((error) => console.error("[solo] low balance notify failed", error));
    sent++;
  }
  return { checked: wallets.length, sent };
}

async function runReconcile(now: Date) {
  const [wallets, campaigns] = await Promise.all([findSoloWalletMismatches(50), findSoloCampaignMismatches(50)]);
  if (wallets.length || campaigns.length) {
    console.error("[solo] reconciliation mismatches", { wallets, campaigns });
    const last = await prisma.platformSetting.findUnique({ where: { key: RECONCILE_ALERT_KEY } });
    const lastAt = typeof last?.value === "string" ? Date.parse(last.value) : NaN;
    if (!(lastAt > now.getTime() - ALERT_COOLDOWN_MS)) {
      await prisma.platformSetting.upsert({
        where: { key: RECONCILE_ALERT_KEY },
        create: { key: RECONCILE_ALERT_KEY, value: now.toISOString() },
        update: { value: now.toISOString() },
      });
      await notifyAdminAlert({
        title: "Solo Ads reconciliation mismatch",
        message: `${wallets.length} wallet(s) and ${campaigns.length} campaign(s) do not match their ledgers or clicks.`,
        actionPath: "/admin/solo-ads",
        actionLabel: "Open Solo Ads overview",
      }).catch((error) => console.error("[solo] reconcile alert failed", error));
    }
  }
  return { walletMismatches: wallets.length, campaignMismatches: campaigns.length };
}

export async function runSoloJob(name: SoloJobName, now = new Date()) {
  const config = await loadSoloAdsConfig();
  const results: Record<string, unknown> = {};
  const run = (job: (typeof SOLO_JOBS)[number]) => name === job || name === "all";

  if (run("finalize-clicks")) {
    results["finalize-clicks"] = await finalizeDueSoloClicks(config, now);
  }
  if (run("status-sweep")) {
    const changes = await sweepSoloCampaignStatuses(now);
    await notifySoloStatusChanges(changes);
    results["status-sweep"] = changes.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.to]: (acc[c.to] ?? 0) + 1 }), {});
  }
  if (run("approve-conversions")) {
    results["approve-conversions"] = await approveMaturedSoloConversions(config.cpaApprovalDays, now);
  }
  if (run("low-balance")) {
    results["low-balance"] = await runLowBalanceAlerts(config.lowBalanceAlertCents, now);
  }
  if (run("reconcile")) {
    results.reconcile = await runReconcile(now);
  }
  return results;
}
