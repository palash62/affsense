import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PublisherMarketplaceReport } from "@/components/publisher/marketplace/publisher-marketplace-report";

export const dynamic = "force-dynamic";

export default async function PublisherMarketplaceReportLogPage() {
  const session = await getSession();
  if (!session || session.user.role !== "PUBLISHER") redirect("/login");

  return <PublisherMarketplaceReport />;
}
