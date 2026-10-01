export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMemberId } from "@/services/user.service";
import { PageHeader } from "@/components/layout/page-header";
import { PublisherCpaOffersList } from "@/components/publisher/cpa-offers/publisher-cpa-offers-list";

export default async function Page() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const memberId = await getMemberId(session.user.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="CPA Offers"
        description="Browse active CPA offers and copy your tracked affiliate links."
        breadcrumbs={[
          { label: "Publisher", href: "/publisher" },
          { label: "CPA Offers" },
        ]}
      />
      <PublisherCpaOffersList publisherId={memberId} />
    </div>
  );
}
