import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { PublisherCpaPostbackForm } from "@/components/publisher/cpa-offers/publisher-cpa-postback-form";

export const dynamic = "force-dynamic";

export default async function PublisherCpaPostbackPage() {
  const session = await getSession();
  if (!session?.user?.id || !isPublisherPortalRole(session.user.role)) {
    redirect("/login");
  }
  return <PublisherCpaPostbackForm />;
}
