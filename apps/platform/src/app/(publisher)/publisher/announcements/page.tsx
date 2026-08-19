import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listPublishedAnnouncements } from "@/services/announcement.service";
import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";

export default async function PublisherAnnouncementsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const announcements = await listPublishedAnnouncements("PUBLISHER", 20);

  return (
    <DashboardCard>
      <DashboardCardTitle>Announcements</DashboardCardTitle>
      <DashboardCardDescription>Platform updates for affiliates</DashboardCardDescription>
      <div className="mt-5">
        <AnnouncementsFeed
          items={announcements}
          emptyLabel="No announcements right now."
        />
      </div>
    </DashboardCard>
  );
}
