import { AnnouncementsFeed } from "@/components/announcements/announcements-feed";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import type { SerializedAnnouncement } from "@/services/announcement.service";

export function LatestAnnouncementsCard({
  announcements,
}: {
  announcements: SerializedAnnouncement[];
}) {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Latest Announcements</DashboardCardTitle>
        <DashboardCardDescription>Platform updates</DashboardCardDescription>
      </div>
      <AnnouncementsFeed
        items={announcements}
        emptyLabel="No published announcements yet."
      />
    </DashboardCard>
  );
}
