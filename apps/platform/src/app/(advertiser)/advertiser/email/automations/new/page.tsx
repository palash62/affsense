import { getSession } from "@/lib/session";
import { listEmailLists } from "@/modules/email-marketing";
import { NewAutomationExperience } from "@/components/advertiser/email/automation-builder";

export const dynamic = "force-dynamic";

export default async function NewEmailAutomationPage() {
  const session = await getSession();
  const allLists = await listEmailLists(session!.user.id);
  const lists = allLists
    .filter((l) => !l.system && l.campaignIds.length > 0)
    .map((l) => ({
      id: l.id,
      name: l.name,
      campaignIds: l.campaignIds,
      campaignNames: l.campaigns.map((c) => c.name),
      campaignId: l.campaignIds[0],
      campaignName: l.campaignName,
    }));

  return <NewAutomationExperience lists={lists} />;
}
