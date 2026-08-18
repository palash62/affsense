import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getCampaignById } from "@/services/campaign.service";
import { ADVERTISER_EXCLUDED_LEAD_STATUSES } from "@/services/lead.service";
import { PageHero } from "@/components/admin/page-hero";
import { AdminCampaignDetails } from "@/components/admin/admin-campaign-details";
import { ButtonLink } from "@/components/ui/button-link";
import { AdvertiserCampaignActions } from "@/components/advertiser/advertiser-campaign-actions";
import { CampaignStatusWithPauseReason } from "@/components/advertiser/campaign-status-with-pause-reason";
import { parseCampaignTargeting } from "@/lib/campaign-targeting";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdvertiserCampaignDetailPage({ params }: PageProps) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  const [campaign, leadCount] = await Promise.all([
    getCampaignById(id),
    prisma.lead.count({
      where: {
        campaignId: id,
        status: { notIn: [...ADVERTISER_EXCLUDED_LEAD_STATUSES] },
      },
    }),
  ]);

  if (!campaign || campaign.advertiserId !== session?.user.id) {
    notFound();
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/advertiser/campaigns" variant="outline" size="sm" className="h-9 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to campaigns
        </ButtonLink>
        <AdvertiserCampaignActions
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
        description="Advertiser Campaign"
        badge={
          <CampaignStatusWithPauseReason
            status={campaign.status}
            pausedReason={campaign.pausedReason}
          />
        }
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
        timezone={session?.user?.timezone}
      />
    </div>
  );
}
