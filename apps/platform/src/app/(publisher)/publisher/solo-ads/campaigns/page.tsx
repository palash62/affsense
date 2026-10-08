import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloStatusBadge, formatUsdCents } from "@/components/solo-ads/solo-shared";
import { ButtonLink } from "@/components/ui/button-link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { listSoloCampaigns } from "@/services/solo-campaign.service";

export const dynamic = "force-dynamic";

export default async function PublisherSoloCampaignsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const campaigns = await listSoloCampaigns(session.user.id);
  const stats = await prisma.soloDailyStats.groupBy({
    by: ["campaignId"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _sum: { billedClicks: true, leads: true, conversions: true, commissionCents: true },
  });
  const statFor = (id: string) => stats.find((s) => s.campaignId === id)?._sum;

  return (
    <SoloPublisherShell
      title="Campaigns"
      description="Your Solo Ads campaigns and how they are performing."
      actions={
        <ButtonLink href="/publisher/solo-ads/campaigns/new" size="sm" className="gap-1">
          <Plus className="h-4 w-4" /> New campaign
        </ButtonLink>
      }
    >
      <div className="premium-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Spent / budget</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Commission</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No campaigns yet.{" "}
                  <Link href="/publisher/solo-ads/campaigns/new" className="text-[var(--theme-primary)] hover:underline">
                    Create your first campaign
                  </Link>
                </TableCell>
              </TableRow>
            ) : null}
            {campaigns.map((c) => {
              const s = statFor(c.id);
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/publisher/solo-ads/campaigns/${c.id}`} className="font-medium hover:text-[var(--theme-primary)]">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {c.cpaOffer?.name ?? c.digitalProduct?.name} · {c.trafficType === "WARM" ? "Warm" : "Regular"} ·{" "}
                      {formatUsdCents(c.cpcCentsSnapshot)}/click
                    </div>
                  </TableCell>
                  <TableCell>
                    <SoloStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsdCents(c.spentCents)} / {formatUsdCents(c.lifetimeBudgetCents)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{(s?.billedClicks ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{(s?.leads ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{(s?.conversions ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsdCents(s?.commissionCents ?? 0)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </SoloPublisherShell>
  );
}
