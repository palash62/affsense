import { Megaphone } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getSession } from "@/lib/session";
import { getSoloAdsAccess } from "@/lib/solo-ads-access";

export const dynamic = "force-dynamic";

export default async function PublisherSoloAdsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "PUBLISHER") redirect("/");
  const { available } = await getSoloAdsAccess(session.user.id);
  if (!available) {
    return (
      <div className="space-y-5">
        <PageHeader title="Solo Ads" breadcrumbs={[{ label: "Solo Ads" }]} />
        <div className="premium-card flex flex-col items-center gap-3 p-10 text-center">
          <Megaphone className="h-10 w-10 text-[var(--theme-primary)]" />
          <h2 className="text-lg font-semibold">Solo Ads is coming soon</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Buy quality email traffic for your offers directly inside Affsense. It is not enabled for your account yet; we will
            let you know as soon as it is.
          </p>
        </div>
      </div>
    );
  }
  return children;
}
