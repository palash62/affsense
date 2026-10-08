import Link from "next/link";
import { redirect } from "next/navigation";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloReportTable } from "@/components/solo-ads/solo-report-table";
import { getSession } from "@/lib/session";
import { getSoloPublisherReport } from "@/services/solo-report.service";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90];

export default async function SoloProvidersPerformancePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 30;
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const report = await getSoloPublisherReport(session.user.id, { from, to, groupBy: "provider" });

  return (
    <SoloPublisherShell
      title="Provider performance"
      description="How each traffic provider performs across all your campaigns. Block weak providers from a campaign's page."
    >
      <div className="flex gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`?days=${p}`}
            className={`rounded-full border px-3 py-1 ${p === days ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border"}`}
          >
            Last {p} days
          </Link>
        ))}
      </div>
      <section className="premium-card overflow-hidden">
        <SoloReportTable
          rows={report.rows}
          totals={report.totals}
          firstColumn="Provider"
          empty="No provider traffic in this period yet."
        />
      </section>
      <p className="text-xs text-muted-foreground">
        Providers are shown by number only. ROI compares commission earned (minus reversals) to what you spent on clicks.
      </p>
    </SoloPublisherShell>
  );
}
