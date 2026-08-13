export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import {
  getAffsensePublisherDashboard,
  type PublisherDashboardPeriod,
} from "@/services/publisher-dashboard.service";
import { AffsensePublisherDashboard } from "@/components/publisher/affsense-dashboard/affsense-publisher-dashboard";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

function parsePeriod(value: string | undefined): PublisherDashboardPeriod {
  if (value === "7d" || value === "30d" || value === "month" || value === "year") {
    return value;
  }
  return "30d";
}

export default async function PublisherDashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const data = await getAffsensePublisherDashboard(session.user.id, period);

  return (
    <Suspense fallback={null}>
      <AffsensePublisherDashboard data={data} />
    </Suspense>
  );
}
