"use client";

import { LayoutGrid, Package, Store, Users } from "lucide-react";
import {
  AffsenseStatCard,
  type AffsenseStatAccent,
} from "@/components/dashboard/affsense-stat-card";
import type { AdminDashboardStats } from "@/services/admin.service";

function fmt(n: number, currency = false) {
  if (currency) {
    return n === 0
      ? "$0.00"
      : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return n.toLocaleString("en-US");
}

export function KpiCards({ stats }: { stats: AdminDashboardStats }) {
  const kpis: Array<{
    id: string;
    label: string;
    value: string;
    sub: string;
    viewHref: string;
    accent: AffsenseStatAccent;
    Icon: typeof Users;
  }> = [
    {
      id: "affiliates",
      label: "Affiliates",
      value: fmt(stats.affiliateCount),
      sub: "all time",
      viewHref: "/admin/publishers",
      accent: "coral",
      Icon: Users,
    },
    {
      id: "digital-products",
      label: "Digital Products",
      value: fmt(stats.activeDigitalProducts),
      sub: "active",
      viewHref: "/admin/digital-products",
      accent: "emerald",
      Icon: Package,
    },
    {
      id: "cpa-offers",
      label: "CPA Offers",
      value: fmt(stats.activeCpaOffers),
      sub: "active",
      viewHref: "/admin/offer-network",
      accent: "amber",
      Icon: Store,
    },
    {
      id: "offer-wall",
      label: "Offer Wall Payout",
      value: fmt(stats.offerWallPayout30d, true),
      sub: "last 30 days",
      viewHref: "/admin/offer-wall/report",
      accent: "navy",
      Icon: LayoutGrid,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <AffsenseStatCard
          key={kpi.id}
          label={kpi.label}
          value={kpi.value}
          icon={kpi.Icon}
          accent={kpi.accent}
          footer={{
            sub: kpi.sub,
            href: kpi.viewHref,
            linkLabel: "View",
          }}
        />
      ))}
    </div>
  );
}
