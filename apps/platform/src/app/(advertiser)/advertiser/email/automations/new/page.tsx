import { getSession } from "@/lib/session";
import { listEmailLists } from "@/modules/email-marketing";
import { NewAutomationExperience } from "@/components/advertiser/email/automation-builder";

export const dynamic = "force-dynamic";

export default async function NewEmailAutomationPage() {
  const session = await getSession();
  const allLists = await listEmailLists(session!.user.id);
  const lists = allLists
    .filter((l) => !l.system && l.campaignId)
    .map((l) => ({
      id: l.id,
      name: l.name,
      campaignId: l.campaignId!,
    }));

  return <NewAutomationExperience lists={lists} />;
}
