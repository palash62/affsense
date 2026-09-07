import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PublisherMarketplaceReport } from "@/components/publisher/marketplace/publisher-marketplace-report";

export default async function PublisherMarketplaceReportPage() {
  const session = await getSession();
  if (!session || session.user.role !== "PUBLISHER") redirect("/login");

  return <PublisherMarketplaceReport />;
}
