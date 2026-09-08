import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { PublisherMarketplacePostbackForm } from "@/components/publisher/marketplace/publisher-marketplace-postback-form";

export const dynamic = "force-dynamic";

export default async function PublisherMarketplacePostbackPage() {
  const session = await getSession();
  if (!session || session.user.role !== "PUBLISHER") redirect("/login");
  return <PublisherMarketplacePostbackForm />;
}
