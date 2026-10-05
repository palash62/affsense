import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { PublisherGetPaidTasksList } from "@/components/publisher/get-paid-tasks/publisher-get-paid-tasks-list";
import { PUBLISHER_GET_PAID_TASKS_ENABLED } from "@/lib/feature-flags";

export default function Page() {
  if (!PUBLISHER_GET_PAID_TASKS_ENABLED) notFound();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Get Paid Tasks"
        description="Browse available tasks, submit proof, and get paid after approval."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "Get Paid Tasks" },
        ]}
      />
      <PublisherGetPaidTasksList />
    </div>
  );
}
