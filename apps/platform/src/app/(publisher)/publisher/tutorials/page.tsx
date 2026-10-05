export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { TutorialsPanel } from "@/components/advertiser/tutorials-panel";
import { PageHeader } from "@/components/layout/page-header";
import { listPublishedTutorials } from "@/services/tutorial.service";

export default async function PublisherTutorialsPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const tutorials = await listPublishedTutorials();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutorials"
        description="Step-by-step guides to help you promote offers and grow your earnings."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Tutorials" },
        ]}
      />
      <TutorialsPanel tutorials={tutorials} />
    </div>
  );
}
