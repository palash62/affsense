export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import {
  CalendarDays,
  Clock,
  FileCheck,
  Gift,
  History,
  Info,
  Package,
  Share2,
  Target,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { formatUserDateTime } from "@/lib/user-timezone";
import { PUBLISHER_REFERRAL_RATE_CARDS, PUBLISHER_REFERRAL_STEPS } from "@/lib/referral";
import { getPublisherReferralData } from "@/services/referral.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency, UserStatusBadge } from "@/components/admin/admin-ui";
import { ReferralLinkPanel } from "@/components/advertiser/referral-link-panel";
import { PublisherReferralChart } from "@/components/publisher/referrals/publisher-referral-chart";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const HEAD_ROW_STYLE = { background: "var(--theme-primary-soft)" };

function signedMoney(amount: number) {
  return amount < 0 ? `-${formatCurrency(Math.abs(amount))}` : `+${formatCurrency(amount)}`;
}

export default async function PublisherReferralsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (!isPublisherPortalRole(session.user.role)) notFound();
  const tz = session.user.timezone;
  const data = await getPublisherReferralData(session.user.id);
  const { stats } = data;

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Affiliate"
        title="Referrals"
        description="Invite affiliates and earn 10% of their Digital Product and 5% of their CPA Offer earnings."
      />

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-foreground"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          You earn <strong>10%</strong> of the commission your referred affiliates make on Digital
          Products and <strong>5%</strong> of their CPA Offer payouts. Their own earnings are not
          reduced. Referral commissions are added to your weekly invoice automatically, and a refunded
          Digital Product sale reverses its referral commission.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard label="Total Referrals" value={stats.totalReferrals} icon={Users} variant="leads" />
        <NeutralStatCard label="Active Referrals" value={stats.activeReferrals} icon={UserCheck} accent="green" />
        <GradientStatCard
          label="Total Earned"
          value={formatCurrency(stats.totalEarned)}
          icon={Wallet}
          variant="revenue"
        />
        <NeutralStatCard
          label="This Month"
          value={formatCurrency(stats.thisMonth)}
          icon={CalendarDays}
          accent="purple"
        />
        <NeutralStatCard
          label="Digital Products (10%)"
          value={formatCurrency(stats.digitalEarned)}
          icon={Package}
          accent="purple"
        />
        <NeutralStatCard
          label="CPA Offers (5%)"
          value={formatCurrency(stats.cpaEarned)}
          icon={Target}
          accent="green"
        />
        <NeutralStatCard
          label="Next Invoice"
          value={formatCurrency(stats.uninvoiced)}
          icon={Clock}
          accent="orange"
        />
        <NeutralStatCard
          label="Already Invoiced"
          value={formatCurrency(stats.invoiced)}
          icon={FileCheck}
          accent="green"
        />
      </div>

      <PageSection
        title="Your Referral Link"
        description="Share this link — affiliates who sign up with it are linked to you"
        icon={Share2}
        gradient="approved"
        contentClassName="p-6"
      >
        <ReferralLinkPanel
          referralCode={data.referralCode}
          variant="publisher"
          description="Invite affiliates to Affsense. When they earn on Digital Products or CPA Offers, you earn a referral commission on top."
        />
      </PageSection>

      <div className="grid gap-4 lg:grid-cols-2">
        {PUBLISHER_REFERRAL_RATE_CARDS.map((card) => (
          <div key={card.source} className="premium-card overflow-hidden">
            <div className="h-1" style={{ background: card.gradient }} />
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Referral commission
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{card.title}</h3>
                </div>
                <div
                  className="rounded-xl px-4 py-2 text-2xl font-bold text-white shadow-sm"
                  style={{ background: card.gradient }}
                >
                  {card.rate}
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Earned so far:{" "}
                {formatCurrency(card.source === "digital" ? stats.digitalEarned : stats.cpaEarned)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <PublisherReferralChart months={data.months} />

      <PageSection
        title="Referred Affiliates"
        description="Affiliates who joined with your link and what they earned since the referral program started"
        icon={Users}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent" style={HEAD_ROW_STYLE}>
                <TableHead className="h-11 px-6 text-muted-foreground">Affiliate</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Joined</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Conversions</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Digital Commission</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">CPA Payout</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Your Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.referrals.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                    No referred affiliates yet. Copy your link above and share it to start earning.
                  </TableCell>
                </TableRow>
              ) : (
                data.referrals.map((referral) => (
                  <TableRow key={referral.id} className="border-border">
                    <TableCell className="px-6 py-4">
                      <p className="font-medium text-foreground">{referral.name}</p>
                      <p className="text-xs text-muted-foreground">{referral.email}</p>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                      {formatUserDateTime(referral.createdAt, tz, "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <UserStatusBadge status={referral.status as "ACTIVE" | "PENDING" | "SUSPENDED"} />
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-foreground">
                      {referral.conversions.toLocaleString("en-US")}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-foreground">
                      {formatCurrency(referral.digitalCommission)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-foreground">
                      {formatCurrency(referral.cpaPayout)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">
                      {formatCurrency(referral.yourCommission)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <PageSection
        title="Commission History"
        description="Your latest 50 referral commissions"
        icon={History}
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent" style={HEAD_ROW_STYLE}>
                <TableHead className="h-11 px-6 text-muted-foreground">Date</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Affiliate</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Source</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Their Earning</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Rate</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Your Commission</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                    No referral commissions yet. You earn when your referred affiliates make sales.
                  </TableCell>
                </TableRow>
              ) : (
                data.history.map((entry) => (
                  <TableRow key={entry.id} className="border-border">
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      {formatUserDateTime(entry.createdAt, tz, "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-foreground">{entry.affiliateName}</TableCell>
                    <TableCell className="px-4 py-4">
                      <Badge variant="outline" className="font-medium">
                        {entry.source === "cpa" ? "CPA Offer" : "Digital Product"}
                        {entry.isReversal ? " · Refund" : ""}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-foreground">
                      {entry.base == null ? "—" : formatCurrency(entry.base)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-muted-foreground">
                      {Math.round(entry.rate * 100)}%
                    </TableCell>
                    <TableCell
                      className={cn(
                        "px-4 py-4 text-right text-sm font-semibold tabular-nums",
                        entry.amount < 0 ? "text-destructive" : "text-emerald-600",
                      )}
                    >
                      {signedMoney(entry.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                      {entry.invoiced ? "Invoiced" : "Next invoice"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <PageSection
        title="How It Works"
        description="Three steps to start earning referral income"
        icon={Gift}
        contentClassName="p-6"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {PUBLISHER_REFERRAL_STEPS.map((step) => (
            <div key={step.step} className="rounded-xl border border-border bg-muted/60 p-5">
              <div
                className="mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: "var(--theme-gradient-revenue)" }}
              >
                {step.step}
              </div>
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </PageSection>
    </div>
  );
}
