"use client";

import { BarChart3 } from "lucide-react";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";

export function TopSellingProductsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Top Selling Products</DashboardCardTitle>
        <DashboardCardDescription>Best performers this period</DashboardCardDescription>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No sales data yet</p>
        <p className="text-xs text-muted-foreground/60">
          Sales tracking will appear here once digital products are sold.
        </p>
      </div>
    </DashboardCard>
  );
}
