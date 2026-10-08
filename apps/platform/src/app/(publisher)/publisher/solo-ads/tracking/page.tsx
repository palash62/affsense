import { formatMemberId, getTrackingUrl } from "@cpl/shared";
import { redirect } from "next/navigation";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloTrackingSetup } from "@/components/solo-ads/publisher/solo-tracking-setup";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrCreateSoloTrackingSite, soloLeadApiUrl, soloScriptSnippet } from "@/services/solo-tracking.service";

export const dynamic = "force-dynamic";

export default async function SoloTrackingSetupPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const publisherId = session.user.id;
  const [site, user, campaigns] = await Promise.all([
    getOrCreateSoloTrackingSite(publisherId),
    prisma.user.findUnique({ where: { id: publisherId }, select: { memberNo: true } }),
    prisma.soloCampaign.findMany({
      where: { publisherId, destinationMode: "EXTERNAL", status: { notIn: ["COMPLETED"] } },
      select: { id: true, name: true, destinationHost: true, trackingVerifiedAt: true, cpaOfferId: true, digitalProductId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const memberId = user ? formatMemberId(user.memberNo) : "AFF100001";
  const first = campaigns[0];
  const sampleOfferLink = first?.cpaOfferId
    ? `${getTrackingUrl()}/cpa/${first.cpaOfferId}?pub_id=${memberId}`
    : first?.digitalProductId
      ? `${getTrackingUrl()}/dp/${first.digitalProductId}?pub_id=${memberId}`
      : `${getTrackingUrl()}/cpa/OFFER_ID?pub_id=${memberId}`;

  return (
    <SoloPublisherShell title="Tracking setup" description="Track Solo Ads traffic that lands on your own opt-in pages.">
      <SoloTrackingSetup
        snippet={soloScriptSnippet(site.siteKey)}
        hosts={site.hosts.map((h) => ({ host: h.host, lastSeenAt: h.lastSeenAt.toISOString() }))}
        campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, host: c.destinationHost, verified: Boolean(c.trackingVerifiedAt) }))}
        leadApiUrl={soloLeadApiUrl()}
        apiKeyPrefix={site.apiKeyPrefix || null}
        sampleOfferLink={sampleOfferLink}
      />
    </SoloPublisherShell>
  );
}
