import { utcToZonedInput } from "@cpl/tracking-core";
import { notFound, redirect } from "next/navigation";
import { SoloCampaignForm } from "@/components/solo-ads/publisher/solo-campaign-form";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getSoloAdsAccess } from "@/lib/solo-ads-access";
import { listSoloEligibleOffers } from "@/services/solo-campaign.service";

export const dynamic = "force-dynamic";

export default async function EditSoloCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const campaign = await prisma.soloCampaign.findFirst({ where: { id, publisherId: session.user.id } });
  if (!campaign) notFound();
  if (campaign.status === "COMPLETED") redirect(`/publisher/solo-ads/campaigns/${id}`);
  const [{ config }, offers] = await Promise.all([getSoloAdsAccess(session.user.id), listSoloEligibleOffers(session.user.id)]);

  return (
    <SoloPublisherShell
      title={`Edit: ${campaign.name}`}
      crumbs={[
        { label: "Campaigns", href: "/publisher/solo-ads/campaigns" },
        { label: campaign.name, href: `/publisher/solo-ads/campaigns/${id}` },
        { label: "Edit" },
      ]}
      description="Changing the offer, landing page, traffic type or countries sends an approved campaign back for review."
    >
      <SoloCampaignForm
        offers={offers}
        config={{
          regularCpcCents: config.regularCpcCents,
          warmCpcCents: config.warmCpcCents,
          supportedCountries: config.supportedCountries,
          minDailyBudgetCents: config.minDailyBudgetCents,
          maxDailyBudgetCents: config.maxDailyBudgetCents,
          defaultTimezone: config.defaultTimezone,
        }}
        initial={{
          id: campaign.id,
          name: campaign.name,
          offerType: campaign.offerType,
          offerId: (campaign.cpaOfferId ?? campaign.digitalProductId) as string,
          trafficType: campaign.trafficType,
          destinationMode: campaign.destinationMode,
          destinationUrl: campaign.destinationUrl ?? "",
          countries: campaign.countries as string[],
          devices: (campaign.devices as string[] | null) ?? [],
          activeHours: (campaign.activeHours as number[] | null) ?? [],
          timezone: campaign.timezone,
          startAt: campaign.startAt ? utcToZonedInput(campaign.startAt, campaign.timezone) : "",
          endAt: campaign.endAt ? utcToZonedInput(campaign.endAt, campaign.timezone) : "",
          dailyBudget: (campaign.dailyBudgetCents / 100).toFixed(2),
          lifetimeBudget: (campaign.lifetimeBudgetCents / 100).toFixed(2),
          cpcCentsSnapshot: campaign.cpcCentsSnapshot,
          status: campaign.status,
        }}
      />
    </SoloPublisherShell>
  );
}
