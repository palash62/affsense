export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/session";
import {
  getAffsenseAdvertiserDashboard,
  type AdvertiserDashboardPeriod,
} from "@/services/advertiser-dashboard.service";
import { AffsenseAdvertiserDashboard } from "@/components/advertiser/affsense-dashboard/affsense-advertiser-dashboard";

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

function parsePeriod(value: string | undefined): AdvertiserDashboardPeriod {
  if (value === "7d" || value === "30d" || value === "month" || value === "year") {
    return value;
  }
  return "30d";
}

export default async function AdvertiserDashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const period = parsePeriod(params.period);
  const data = await getAffsenseAdvertiserDashboard(session.user.id, period);

  return (
    <Suspense fallback={null}>
      <AffsenseAdvertiserDashboard data={data} />
    </Suspense>
  );
}
