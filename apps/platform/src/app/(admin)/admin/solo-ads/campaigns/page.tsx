import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloCampaignReviewTable, type AdminSoloCampaignRow } from "@/components/solo-ads/admin/solo-campaign-review-table";
import { listSoloCampaignsForAdmin } from "@/services/solo-admin.service";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ status?: string; q?: string }> };

export default async function AdminSoloAdsCampaignsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status = params.status ?? "PENDING_REVIEW";
  const campaigns = await listSoloCampaignsForAdmin({ status: status || null, q: params.q });
  const rows: AdminSoloCampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    statusReason: c.statusReason,
    offerType: c.offerType,
    offerName: c.cpaOffer?.name ?? c.digitalProduct?.name ?? "Unknown offer",
    offerActive: (c.cpaOffer?.status ?? c.digitalProduct?.status) === "ACTIVE",
    trafficType: c.trafficType,
    destinationMode: c.destinationMode,
    destinationUrl: c.destinationUrl,
    trackingVerified: Boolean(c.trackingVerifiedAt),
    countries: Array.isArray(c.countries) ? (c.countries as string[]) : [],
    dailyBudgetCents: c.dailyBudgetCents,
    lifetimeBudgetCents: c.lifetimeBudgetCents,
    spentCents: c.spentCents,
    cpcCentsSnapshot: c.cpcCentsSnapshot,
    priority: c.priority,
    submittedAt: c.submittedAt?.toISOString() ?? null,
    publisher: c.publisher,
  }));
  return (
    <SoloAdminShell title="Campaigns" description="Review new campaigns and manage running ones.">
      <SoloCampaignReviewTable campaigns={rows} status={status} />
    </SoloAdminShell>
  );
}
