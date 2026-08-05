import { getSession } from "@/lib/session";
import { listEmailLists } from "@/modules/email-marketing";
import { AutomationBuilderShell } from "@/components/advertiser/email/automation-builder/automation-builder-shell";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditEmailAutomationPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const allLists = await listEmailLists(session!.user.id);
  const lists = allLists
    .filter((l) => !l.system && l.campaignId)
    .map((l) => ({
      id: l.id,
      name: l.name,
      campaignId: l.campaignId!,
      campaignName: l.campaignName,
    }));

  return <AutomationBuilderShell automationId={id} lists={lists} />;
}
