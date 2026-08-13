export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { formatUserDateTime, resolveUserTimezone } from "@/lib/user-timezone";
import { getPublisherSettings } from "@/services/user.service";
import { prisma } from "@/lib/prisma";
import { PublisherSettingsView } from "@/components/publisher/settings/publisher-settings-view";

export default async function PublisherSettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const user = await getPublisherSettings(session.user.id);

  if (!user) {
    return null;
  }

  const approvedLeads = await prisma.lead.count({
    where: { publisherId: user.id, status: { in: ["APPROVED", "PAID"] } },
  });

  const timezone = resolveUserTimezone(user.timezone);

  return (
    <PublisherSettingsView
      name={user.name}
      email={user.email}
      role={user.role}
      status={user.status}
      kycStatus={user.publisherProfile?.kycStatus ?? null}
      rejectionReason={user.publisherProfile?.rejectionReason ?? ""}
      website={user.publisherProfile?.website ?? ""}
      trafficSource={user.publisherProfile?.trafficSource ?? ""}
      timezone={timezone}
      memberSince={formatUserDateTime(user.createdAt, timezone, "MMM d, yyyy")}
      totalLeads={user._count.leads}
      approvedLeads={approvedLeads}
      availableBalance={user.wallet ? Number(user.wallet.balance) : 0}
    />
  );
}
