import { redirect } from "next/navigation";
import { SoloCampaignForm } from "@/components/solo-ads/publisher/solo-campaign-form";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { getSession } from "@/lib/session";
import { getSoloAdsAccess } from "@/lib/solo-ads-access";
import { listSoloEligibleOffers } from "@/services/solo-campaign.service";

export const dynamic = "force-dynamic";

export default async function NewSoloCampaignPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const [{ config }, offers] = await Promise.all([getSoloAdsAccess(session.user.id), listSoloEligibleOffers(session.user.id)]);
  return (
    <SoloPublisherShell
      title="New campaign"
      crumbs={[{ label: "Campaigns", href: "/publisher/solo-ads/campaigns" }, { label: "New" }]}
      description="Choose an offer, who should see it, and how much to spend. Every campaign is reviewed before it goes live."
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
      />
    </SoloPublisherShell>
  );
}
