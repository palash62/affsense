import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, DollarSign, MousePointerClick, Plus, TrendingUp, UserPlus, Wallet } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloStatusBadge, formatUsdCents, soloPct } from "@/components/solo-ads/solo-shared";
import { ButtonLink } from "@/components/ui/button-link";
import { getSession } from "@/lib/session";
import { getSoloAdsAccess } from "@/lib/solo-ads-access";
import { getSoloPublisherOverview } from "@/services/solo-report.service";
import { getSoloWalletSummary } from "@/services/solo-wallet.service";

export const dynamic = "force-dynamic";

export default async function SoloAdsOverviewPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const [{ config }, wallet, overview] = await Promise.all([
    getSoloAdsAccess(session.user.id),
    getSoloWalletSummary(session.user.id),
    getSoloPublisherOverview(session.user.id),
  ]);
  const t = overview.totals;
  const totalCampaigns = Object.values(overview.statusCounts).reduce((a, b) => a + b, 0);
  const active = overview.statusCounts.ACTIVE ?? 0;
  const lowFunds = active > 0 && wallet.availableCents < Math.max(config.lowBalanceAlertCents, config.regularCpcCents);
  const maxBar = Math.max(1, ...overview.daily.map((d) => Math.max(d.spendCents, d.commissionCents)));
  const steps = [
    { done: wallet.balanceCents > 0, label: "Add funds to your ad wallet", href: "/publisher/solo-ads/wallet" },
    { done: totalCampaigns > 0, label: "Create your first campaign", href: "/publisher/solo-ads/campaigns/new" },
    { done: (overview.statusCounts.ACTIVE ?? 0) + (overview.statusCounts.COMPLETED ?? 0) > 0, label: "Get approved and start receiving clicks", href: "/publisher/solo-ads/campaigns" },
  ];

  return (
    <SoloPublisherShell
      title="Solo Ads"
      description="Buy email clicks for your offers and track every lead and sale back to the provider who sent it."
      actions={
        <ButtonLink href="/publisher/solo-ads/campaigns/new" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> New campaign
        </ButtonLink>
      }
    >
      {lowFunds ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>
            Your ad wallet is running low ({formatUsdCents(wallet.availableCents)} available). Active campaigns pause automatically
            when funds run out.
          </span>
          <Link href="/publisher/solo-ads/wallet" className="font-medium underline">
            Add funds
          </Link>
        </div>
      ) : null}
      {(overview.statusCounts.INSUFFICIENT_FUNDS ?? 0) > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {overview.statusCounts.INSUFFICIENT_FUNDS} campaign(s) are waiting for funds and will resume as soon as you top up.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <GradientStatCard label="Ad wallet available" value={formatUsdCents(wallet.availableCents)} icon={Wallet} variant="approved" />
        <GradientStatCard label="Spent (30 days)" value={formatUsdCents(t.spendCents)} icon={DollarSign} variant="revenue" />
        <NeutralStatCard label="Paid clicks (30 days)" value={t.billedClicks.toLocaleString()} icon={MousePointerClick} accent="purple" />
        <NeutralStatCard label={`Leads · ${soloPct(t.leads, t.billedClicks)} opt-in`} value={t.leads.toLocaleString()} icon={UserPlus} accent="orange" />
        <NeutralStatCard
          label={t.spendCents > 0 ? `Commission · ROI ${Math.round(((t.commissionCents - t.spendCents) / t.spendCents) * 100)}%` : "Commission (30 days)"}
          value={formatUsdCents(t.commissionCents)}
          icon={TrendingUp}
          accent="green"
        />
      </div>

      {totalCampaigns === 0 || wallet.balanceCents <= 0 ? (
        <section className="premium-card space-y-3 p-6">
          <h2 className="text-base font-semibold">Get started</h2>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                {s.done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <Link href={s.href} className={s.done ? "text-muted-foreground line-through" : "font-medium hover:underline"}>
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Regular clicks cost {formatUsdCents(config.regularCpcCents)}, warm clicks {formatUsdCents(config.warmCpcCents)}. You are only
            charged for clicks that pass our quality checks.
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="premium-card p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">Spend vs commission, last 30 days</h2>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-[var(--theme-primary)]" /> Spend
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Commission
              </span>
            </div>
          </div>
          {overview.daily.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No traffic yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {overview.daily.map((d) => (
                <div
                  key={d.date}
                  className="flex h-full flex-1 items-end gap-px"
                  title={`${d.date}: spend ${formatUsdCents(d.spendCents)}, commission ${formatUsdCents(d.commissionCents)}, ${d.clicks} clicks`}
                >
                  <div className="flex-1 rounded-t bg-[var(--theme-primary)]" style={{ height: `${(d.spendCents / maxBar) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-emerald-500" style={{ height: `${(Math.max(0, d.commissionCents) / maxBar) * 100}%` }} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="premium-card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Campaigns</h2>
            <Link href="/publisher/solo-ads/campaigns" className="text-sm font-medium text-[var(--theme-primary)] hover:underline">
              View all
            </Link>
          </div>
          {overview.recentCampaigns.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No campaigns yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {overview.recentCampaigns.map((c) => {
                const pct = c.lifetimeBudgetCents > 0 ? Math.min(100, (c.spentCents / c.lifetimeBudgetCents) * 100) : 0;
                return (
                  <li key={c.id} className="px-6 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/publisher/solo-ads/campaigns/${c.id}`} className="truncate text-sm font-medium hover:underline">
                        {c.name}
                      </Link>
                      <SoloStatusBadge status={c.status} />
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[var(--theme-primary)]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatUsdCents(c.spentCents)} of {formatUsdCents(c.lifetimeBudgetCents)} · {c.paidClicks.toLocaleString()} clicks
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </SoloPublisherShell>
  );
}
