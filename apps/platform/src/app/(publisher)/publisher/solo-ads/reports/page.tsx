import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloReportTable } from "@/components/solo-ads/solo-report-table";
import { SELECT_CLASS } from "@/components/solo-ads/solo-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getSoloPublisherReport, resolveSoloReportRange } from "@/services/solo-report.service";

export const dynamic = "force-dynamic";

const GROUPS = [
  { value: "campaign", label: "Campaign" },
  { value: "provider", label: "Provider" },
  { value: "day", label: "Day" },
];

type Search = { from?: string; to?: string; groupBy?: string; campaignId?: string };

export default async function SoloReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  let range: { from: string; to: string };
  try {
    range = resolveSoloReportRange(params.from, params.to);
  } catch {
    range = resolveSoloReportRange(null, null);
  }
  const campaigns = await prisma.soloCampaign.findMany({
    where: { publisherId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  const campaignId = campaigns.some((c) => c.id === params.campaignId) ? params.campaignId! : null;
  const report = await getSoloPublisherReport(session.user.id, { ...range, groupBy: params.groupBy, campaignId });
  const exportQs = new URLSearchParams({ from: range.from, to: range.to, groupBy: report.groupBy, ...(campaignId ? { campaignId } : {}) });

  return (
    <SoloPublisherShell title="Reports" description="Dates follow each campaign's own timezone.">
      <form method="get" className="premium-card flex flex-wrap items-end gap-3 p-5">
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">From</span>
          <Input type="date" name="from" defaultValue={range.from} className="w-40" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <Input type="date" name="to" defaultValue={range.to} className="w-40" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Group by</span>
          <select name="groupBy" defaultValue={report.groupBy} className={`${SELECT_CLASS} w-36`}>
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Campaign</span>
          <select name="campaignId" defaultValue={campaignId ?? ""} className={`${SELECT_CLASS} w-56`}>
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Apply</Button>
        <a
          href={`/api/v1/publisher/solo-ads/reports/export?${exportQs.toString()}`}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Export CSV
        </a>
      </form>

      <section className="premium-card overflow-hidden">
        <SoloReportTable
          rows={report.rows}
          totals={report.totals}
          firstColumn={GROUPS.find((g) => g.value === report.groupBy)!.label}
          renderLabel={
            report.groupBy === "campaign"
              ? (r) => (
                  <Link href={`/publisher/solo-ads/campaigns/${r.key}`} className="font-medium text-[var(--theme-primary)] hover:underline">
                    {r.label}
                  </Link>
                )
              : undefined
          }
        />
      </section>
      <p className="text-xs text-muted-foreground">
        Commission includes pending and approved sales, minus reversed sales. Filtered clicks failed quality checks and
        were not charged.
      </p>
    </SoloPublisherShell>
  );
}
