import Link from "next/link";
import { Fragment, Suspense } from "react";
import { BarChart3, Eye, Link2, Megaphone, MousePointerClick, Users, Wallet } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency, UserStatusBadge } from "@/components/admin/admin-ui";
import { AdminPromotionLinkForm } from "@/components/admin/admin-promotion-link-form";
import { AdminPromotionFilters } from "@/components/admin/admin-promotion-filters";
import { getMarketingAppUrl } from "@/lib/email/email-marketing-settings";
import { getSession } from "@/lib/session";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getAdminPromotionReport } from "@/services/promotion.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}

export default async function AdminPromotionPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const params = await searchParams;
  const fromDate = params.from ? new Date(params.from) : undefined;
  const toDate = params.to ? new Date(params.to) : undefined;
  const report = await getAdminPromotionReport({
    q: params.q,
    from: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
    to: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
  });
  const appOrigin = getMarketingAppUrl().replace(/\/$/, "");

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Marketing"
        title="Promotion"
        description="Generate tracked promotion links for Facebook and other channels, then see clicks, visits, signups, and deposits"
        badge={`${report.stats.totalClicks} clicks`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard
          variant="leads"
          label="Clicks"
          value={report.stats.totalClicks}
          icon={MousePointerClick}
        />
        <NeutralStatCard
          label="Visits"
          value={report.stats.totalVisits}
          icon={Eye}
          accent="green"
        />
        <NeutralStatCard
          label="Unique visitors"
          value={report.stats.uniqueVisitors}
          icon={Users}
          accent="purple"
        />
        <GradientStatCard
          variant="leads"
          label="Attributed signups"
          value={report.stats.attributedSignups}
          icon={Megaphone}
        />
        <NeutralStatCard
          label="Unattributed signups"
          value={report.stats.unattributedSignups}
          icon={Users}
          accent="orange"
        />
        <GradientStatCard
          variant="revenue"
          label="Attributed deposits"
          value={formatCurrency(report.stats.attributedDeposits)}
          icon={Wallet}
        />
        <NeutralStatCard
          label="Active promotions"
          value={report.stats.activePromotions}
          icon={Link2}
          accent="purple"
        />
      </div>

      <PageSection
        title="Tracking links"
        description="Create promotion campaigns and copy UTM links for your ads"
        icon={Link2}
        gradient="leads"
        contentClassName="space-y-4 p-6"
      >
        <AdminPromotionLinkForm appOrigin={appOrigin} />
      </PageSection>

      <PageSection
        title="Attribution report"
        description="Clicks, visits, advertiser signups, and completed wallet deposits grouped by full UTM"
        icon={BarChart3}
        gradient="revenue"
        contentClassName="space-y-4 p-6"
      >
        <Suspense fallback={null}>
          <AdminPromotionFilters />
        </Suspense>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-4 text-slate-600">Source</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Medium</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Campaign</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Content</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Term</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Clicks</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Visits</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Unique</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Signups</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Signup %</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Deposits</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Avg deposit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={12} className="px-6 py-16 text-center text-slate-500">
                    No promotion clicks, visits, or attributed signups yet.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => {
                  const avgDeposit =
                    row.signupCount > 0 ? row.totalDeposits / row.signupCount : 0;
                  const rowKey = [
                    row.utmSource,
                    row.utmMedium,
                    row.utmCampaign,
                    row.utmContent,
                    row.utmTerm,
                  ].join("|");

                  return (
                    <Fragment key={rowKey}>
                      <TableRow className="border-slate-100">
                        <TableCell className="px-4 py-4 text-sm text-slate-700">{row.utmSource}</TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700">{row.utmMedium}</TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700">{row.utmCampaign}</TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700">{row.utmContent}</TableCell>
                        <TableCell className="px-4 py-4 text-sm text-slate-700">{row.utmTerm}</TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                          {row.clickCount}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                          {row.visitCount}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                          {row.uniqueVisits}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                          {row.signupCount}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-slate-600">
                          {row.signupRate === null ? "—" : `${row.signupRate}%`}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">
                          {formatCurrency(row.totalDeposits)}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-slate-600">
                          {formatCurrency(avgDeposit)}
                        </TableCell>
                      </TableRow>
                      {row.advertisers.map((advertiser) => (
                        <TableRow key={advertiser.id} className="border-slate-100 bg-slate-50/60">
                          <TableCell className="px-4 py-3 pl-8" colSpan={3}>
                            <Link
                              href={`/admin/advertisers/${advertiser.id}`}
                              className="font-medium text-slate-900 hover:underline"
                            >
                              {advertiser.name}
                            </Link>
                            <p className="text-xs text-slate-500">{advertiser.email}</p>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-slate-600" colSpan={5}>
                            {formatUserDateTime(advertiser.createdAt, tz, "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="px-4 py-3" colSpan={3}>
                            <UserStatusBadge
                              status={advertiser.status as "ACTIVE" | "PENDING" | "SUSPENDED"}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-sm tabular-nums text-slate-700">
                            {formatCurrency(advertiser.depositTotal)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </div>
  );
}
