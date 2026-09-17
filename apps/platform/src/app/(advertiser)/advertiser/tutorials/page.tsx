export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TutorialsPanel } from "@/components/advertiser/tutorials-panel";
import { PageHeader } from "@/components/layout/page-header";
import { listTutorialsForAdvertiser } from "@/services/tutorial.service";

export default async function AdvertiserTutorialsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tutorials = await listTutorialsForAdvertiser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutorials"
        description="Watch step-by-step guides to set up campaigns, funnels, and grow your results faster."
        breadcrumbs={[
          { label: "Advertiser", href: "/advertiser" },
          { label: "Tutorials" },
        ]}
      />
      <TutorialsPanel tutorials={tutorials} />
    </div>
  );
}
