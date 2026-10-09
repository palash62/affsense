import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, DollarSign, Landmark, MousePointerClick, Radio, ShieldAlert } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { formatUsdCents, soloPct } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getSoloAdminOverview } from "@/services/solo-report.service";
import { countPendingSoloWiseDeposits } from "@/services/solo-wallet.service";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsOverviewPage() {
  const [o, pendingWise] = await Promise.all([getSoloAdminOverview(), countPendingSoloWiseDeposits()]);
  const publisherIds = [...new Set([...o.walletMismatches, ...o.campaignMismatches].map((m) => m.publisherId))];
  const publishers = publisherIds.length
    ? await prisma.user.findMany({ where: { id: { in: publisherIds } }, select: { id: true, email: true } })
    : [];
  const emailOf = (id: string) => publishers.find((p) => p.id === id)?.email ?? id;
  const healthy = o.walletMismatches.length === 0 && o.campaignMismatches.length === 0 && o.staleClicks === 0;
  const t = o.totals30;

  return (
    <SoloAdminShell title="Solo Ads" description="Marketplace health, money and traffic quality at a glance.">
      {pendingWise > 0 ? (
        <Link
          href="/admin/solo-ads/wallets"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100"
        >
          <span>
            {pendingWise} Wise deposit{pendingWise > 1 ? "s are" : " is"} waiting for your review.
          </span>
          <span className="font-medium">Review now</span>
        </Link>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GradientStatCard label="Click revenue (30 days)" value={formatUsdCents(t.spendCents)} icon={DollarSign} variant="revenue" />
        <GradientStatCard label="Ad credit liability" value={formatUsdCents(o.liabilities.balanceCents)} icon={Landmark} variant="leads" />
        <NeutralStatCard label="Deposits (30 days)" value={formatUsdCents(o.deposits30.amountCents)} icon={DollarSign} accent="green" />
        <NeutralStatCard label="Clicks (24 hours)" value={o.clicks24h.total.toLocaleString()} icon={MousePointerClick} accent="purple" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/solo-ads/campaigns">
          <NeutralStatCard label="Waiting for review" value={o.pendingReview} icon={ClipboardCheck} accent={o.pendingReview ? "orange" : "purple"} />
        </Link>
        <NeutralStatCard label="Active campaigns" value={o.activeCampaigns} icon={Radio} accent="green" />
        <Link href="/admin/solo-ads/providers">
          <NeutralStatCard label="Active providers" value={o.providers} icon={Radio} accent="purple" />
        </Link>
        <Link href="/admin/solo-ads/fraud">
          <NeutralStatCard
            label={`Filtered (24h) · ${soloPct(o.clicks24h.invalid, o.clicks24h.total)}`}
            value={o.clicks24h.invalid.toLocaleString()}
            icon={ShieldAlert}
            accent={o.clicks24h.total > 0 && o.clicks24h.invalid / o.clicks24h.total > 0.2 ? "red" : "orange"}
          />
        </Link>
      </div>

      <section className="premium-card p-6">
        <h2 className="mb-3 text-base font-semibold">Last 30 days</h2>
        <div className="grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Paid clicks", t.billedClicks.toLocaleString()],
            ["Filtered", t.invalidClicks.toLocaleString()],
            ["Leads", `${t.leads.toLocaleString()} (${soloPct(t.leads, t.billedClicks)})`],
            ["Sales", t.conversions.toLocaleString()],
            ["Affiliate commission", formatUsdCents(t.commissionCents)],
            ["Reserved now", formatUsdCents(o.liabilities.reservedCents)],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Last 24 hours: {o.clicks24h.billed} billed, {o.clicks24h.pending} pending validation, {o.clicks24h.fallback} sent to
          fallback (no eligible campaign), {o.clicks24h.refunded} refunded.
        </p>
      </section>

      <section className="premium-card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-6 py-4">
          {healthy ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          <h2 className="text-base font-semibold">Reconciliation</h2>
        </div>
        {healthy ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">
            All wallet balances match their ledgers and all reservations match pending clicks.
          </p>
        ) : (
          <div className="space-y-4 p-6">
            {o.staleClicks > 0 ? (
              <p className="text-sm text-amber-800">
                {o.staleClicks} click(s) have been pending for more than 2 hours. Check that the Solo Ads cron job is running.
              </p>
            ) : null}
            {o.walletMismatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet owner</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Ledger sum</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Pending clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.walletMismatches.map((m) => (
                    <TableRow key={m.walletId}>
                      <TableCell>{emailOf(m.publisherId)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${m.balanceCents !== m.ledgerCents ? "text-red-600" : ""}`}>
                        {formatUsdCents(m.balanceCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsdCents(m.ledgerCents)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${m.reservedCents !== m.pendingCents ? "text-red-600" : ""}`}>
                        {formatUsdCents(m.reservedCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsdCents(m.pendingCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
            {o.campaignMismatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="text-right">Billed clicks</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Pending clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {o.campaignMismatches.map((m) => (
                    <TableRow key={m.campaignId}>
                      <TableCell className="font-mono text-xs">{m.campaignId}</TableCell>
                      <TableCell>{emailOf(m.publisherId)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${m.spentCents !== m.billedCents ? "text-red-600" : ""}`}>
                        {formatUsdCents(m.spentCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsdCents(m.billedCents)}</TableCell>
                      <TableCell className={`text-right tabular-nums ${m.reservedCents !== m.pendingCents ? "text-red-600" : ""}`}>
                        {formatUsdCents(m.reservedCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatUsdCents(m.pendingCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>
        )}
      </section>
    </SoloAdminShell>
  );
}
