"use client";

import { cn } from "@/lib/utils";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import { affsenseTopProducts } from "./mock-data";

export function TopSellingProductsCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-4">
        <DashboardCardTitle>Top Selling Products</DashboardCardTitle>
        <DashboardCardDescription>Best performers this week</DashboardCardDescription>
      </div>
      <ul className="space-y-3">
        {affsenseTopProducts.map((product) => (
          <li key={product.rank} className="flex items-center gap-3">
            <span className="w-5 text-sm font-bold text-muted-foreground">{product.rank}</span>
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-xs font-bold text-white shadow-sm",
                product.thumbTone,
              )}
            >
              {product.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">{product.sales}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground">
              {product.revenue}
            </span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
