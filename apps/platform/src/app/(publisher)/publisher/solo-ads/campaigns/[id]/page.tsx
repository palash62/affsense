import { localDate } from "@cpl/tracking-core";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DollarSign, MousePointerClick, ShoppingCart, TrendingUp, UserPlus } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloCampaignActions } from "@/components/solo-ads/publisher/solo-campaign-actions";
import { SoloCampaignProviders } from "@/components/solo-ads/publisher/solo-campaign-providers";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloStatusBadge, formatUsdCents } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOwnedSoloCampaign, listSoloCampaignProviders } from "@/services/solo-campaign.service";

export const dynamic = "force-dynamic";

export default async function SoloCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const campaign = await getOwnedSoloCampaign(session.user.id, id).catch(() => null);
  if (!campaign) notFound();

  const today = localDate(new Date(), campaign.timezone);
  const [providers, totals, daily, usage] = await Promise.all([
    listSoloCampaignProviders(session.user.id, id),
    prisma.soloDailyStats.aggregate({
      where: { campaignId: id },
      _sum: { clicks: true, billedClicks: true, invalidClicks: true, spendCents: true, leads: true, conversions: true, commissionCents: true, reversedCents: true },
    }),
    prisma.soloDailyStats.groupBy({
      by: ["localDate"],
      where: { campaignId: id },
      _sum: { billedClicks: true, invalidClicks: true, spendCents: true, leads: true, conversions: true, commissionCents: true, reversedCents: true },
      orderBy: { localDate: "desc" },
      take: 14,
    }),
    prisma.soloDailyUsage.findUnique({ where: { campaignId_localDate: { campaignId: id, localDate: today } } }),
  ]);
  const t = totals._sum;
  const spend = t.spendCents ?? 0;
  const commission = (t.commissionCents ?? 0) - (t.reversedCents ?? 0);
  const roi = spend > 0 ? Math.round(((commission - spend) / spend) * 100) : null;
  const adminPaused = campaign.status === "PAUSED" && Boolean(campaign.statusReason?.startsWith("Paused by Affsense"));
  const usedToday = (usage?.spentCents ?? 0) + (usage?.reservedCents ?? 0);

  return (
    <SoloPublisherShell
      title={campaign.name}
      crumbs={[{ label: "Campaigns", href: "/publisher/solo-ads/campaigns" }, { label: campaign.name }]}
      actions={<SoloCampaignActions id={campaign.id} status={campaign.status} adminPaused={adminPaused} />}
    >
      <div className="premium-card flex flex-wrap items-center gap-x-8 gap-y-3 p-5 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <SoloStatusBadge status={campaign.status} />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Offer</div>
          <div className="font-medium">{campaign.cpaOffer?.name ?? campaign.digitalProduct?.name}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Traffic</div>
          <div className="font-medium">
            {campaign.trafficType === "WARM" ? "Warm" : "Regular"} · {formatUsdCents(campaign.cpcCentsSnapshot)}/click
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Today</div>
          <div className="font-medium">
            {formatUsdCents(usedToday)} of {formatUsdCents(campaign.dailyBudgetCents)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="font-medium">
            {formatUsdCents(campaign.spentCents)} of {formatUsdCents(campaign.lifetimeBudgetCents)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Countries</div>
          <div className="font-medium">{(campaign.countries as string[]).join(", ")}</div>
        </div>
      </div>

      {campaign.statusReason ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{campaign.statusReason}</div>
      ) : null}

      {campaign.destinationMode === "EXTERNAL" ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            campaign.trackingVerifiedAt ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          Landing page: <span className="font-medium">{campaign.destinationUrl}</span>
          <br />
          {campaign.trackingVerifiedAt ? (
            "Tracking script detected on this site."
          ) : (
            <>
              We have not detected the tracking script on {campaign.destinationHost} yet. Traffic starts only after it is
              installed.{" "}
              <Link href="/publisher/solo-ads/tracking" className="font-medium underline">
                Open tracking setup
              </Link>
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <GradientStatCard label="Spent" value={formatUsdCents(spend)} icon={DollarSign} variant="revenue" />
        <NeutralStatCard label="Paid clicks" value={(t.billedClicks ?? 0).toLocaleString()} icon={MousePointerClick} accent="purple" />
        <NeutralStatCard label="Leads" value={(t.leads ?? 0).toLocaleString()} icon={UserPlus} accent="orange" />
        <NeutralStatCard label="Sales" value={(t.conversions ?? 0).toLocaleString()} icon={ShoppingCart} accent="green" />
        <GradientStatCard
          label={roi == null ? "Commission" : `Commission (ROI ${roi}%)`}
          value={formatUsdCents(commission)}
          icon={TrendingUp}
          variant="approved"
        />
      </div>
      {(t.invalidClicks ?? 0) > 0 ? (
        <p className="text-xs text-muted-foreground">
          {(t.invalidClicks ?? 0).toLocaleString()} clicks were filtered out by quality checks and not charged.
        </p>
      ) : null}

      <section className="premium-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Providers</h2>
          <p className="text-sm text-muted-foreground">Block a provider to stop receiving their traffic on this campaign.</p>
        </div>
        <SoloCampaignProviders campaignId={campaign.id} rows={providers} editable={campaign.status !== "COMPLETED"} />
      </section>

      <section className="premium-card overflow-hidden">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Last 14 days</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date ({campaign.timezone})</TableHead>
              <TableHead className="text-right">Paid clicks</TableHead>
              <TableHead className="text-right">Filtered</TableHead>
              <TableHead className="text-right">Spend</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {daily.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No traffic yet.
                </TableCell>
              </TableRow>
            ) : null}
            {daily.map((d) => (
              <TableRow key={d.localDate}>
                <TableCell>{d.localDate}</TableCell>
                <TableCell className="text-right tabular-nums">{d._sum.billedClicks ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{d._sum.invalidClicks ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(d._sum.spendCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{d._sum.leads ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{d._sum.conversions ?? 0}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents((d._sum.commissionCents ?? 0) - (d._sum.reversedCents ?? 0))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </SoloPublisherShell>
  );
}
