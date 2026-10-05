import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/components/layout/placeholder-page";
import { PUBLISHER_GET_PAID_TASKS_ENABLED } from "@/lib/feature-flags";

export default function Page() {
  if (!PUBLISHER_GET_PAID_TASKS_ENABLED) notFound();
  return (
    <PlaceholderPage
      title="Task Reports"
      description="Content coming soon."
    />
  );
}
