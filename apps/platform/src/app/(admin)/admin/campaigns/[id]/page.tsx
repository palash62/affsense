import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { getCampaignById } from "@/services/campaign.service";
import { PageHero } from "@/components/admin/page-hero";
import { AdminCampaignActions } from "@/components/admin/admin-campaign-actions";
import { AdminCampaignDetails } from "@/components/admin/admin-campaign-details";
import { AdminCampaignReviewDialog } from "@/components/admin/admin-campaign-review-dialog";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSection } from "@/components/admin/page-section";
import { Building2 } from "lucide-react";
import { parseCampaignTargeting } from "@/lib/campaign-targeting";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminCampaignDetailPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const tz = session?.user?.timezone;
  const campaign = await getCampaignById(id);

  if (!campaign) {
    notFound();
  }

  const leadCount = campaign._count?.leads ?? 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/admin/campaigns" variant="outline" size="sm" className="h-9 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to campaigns
        </ButtonLink>
        <AdminCampaignActions
          campaign={{
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            leadCount,
            funnelSlug:
              campaign.optinPages[0]?.slug ??
              parseCampaignTargeting(campaign.targeting).optinSlug,
          }}
        />
      </div>

      <PageHero
        eyebrow="Campaign"
        title={campaign.name}
        description={campaign.advertiser.name}
        badge={campaign.status}
      />

      <AdminCampaignDetails
        campaign={{
          id: campaign.id,
          name: campaign.name,
          description: campaign.description,
          category: campaign.category,
          cpl: Number(campaign.cpl),
          budget: campaign.budget == null ? null : Number(campaign.budget),
          spent: Number(campaign.spent),
          dailyCap: campaign.dailyCap,
          monthlyCap: campaign.monthlyCap,
          status: campaign.status,
          pausedReason: campaign.pausedReason,
          targeting: campaign.targeting,
          pixelToken: campaign.pixelToken,
          rejectionReason: campaign.rejectionReason,
          rejectedAt: campaign.rejectedAt,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt,
          advertiser: campaign.advertiser,
          fields: campaign.fields,
          publisherCampaigns: campaign.publisherCampaigns,
          leadCount,
        }}
        timezone={tz}
      />

      {campaign.status === "PENDING" && (
        <PageSection title="Review decision" icon={Building2} gradient="revenue">
          <div className="px-6 py-5">
            <AdminCampaignReviewDialog
              campaign={{
                ...campaign,
                cpl: Number(campaign.cpl),
                budget: campaign.budget == null ? null : Number(campaign.budget),
                spent: Number(campaign.spent),
                _count: { leads: leadCount },
              }}
            />
          </div>
        </PageSection>
      )}
    </div>
  );
}
