import { getSession } from "@/lib/session";
import { listEmailLists } from "@/modules/email-marketing";
import { AutomationBuilderShell } from "@/components/advertiser/email/automation-builder/automation-builder-shell";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditEmailAutomationPage({ params }: Props) {
  const { id } = await params;
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit automation"
        description="Update the trigger, waits, and emails on the canvas."
        breadcrumbs={[
          { label: "Advertiser", href: "/advertiser" },
          { label: "Email", href: "/advertiser/email" },
          { label: "Automations", href: "/advertiser/email/automations" },
          { label: "Edit" },
        ]}
      />
      <AutomationBuilderShell automationId={id} lists={lists} />
    </div>
  );
}
