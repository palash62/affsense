import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import { DashboardCard } from "@/components/admin/affsense-dashboard/dashboard-card";
import { PageHeader } from "@/components/layout/page-header";

export default async function AdvertiserAnnouncementsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const announcements = await listPublishedAnnouncements("ADVERTISER", 20);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Announcements"
        description="Platform updates for advertisers"
        breadcrumbs={[
          { label: "Advertiser", href: "/advertiser" },
          { label: "Announcements" },
        ]}
      />

      <DashboardCard>
        <AnnouncementsFeed
          items={announcements}
          emptyLabel="No announcements right now."
        />
      </DashboardCard>
    </div>
  );
}
