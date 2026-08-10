"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "./dashboard-card";
import { affsenseSalesBySource, affsenseSalesTotal } from "./mock-data";

export function SalesBySourceCard() {
  return (
    <DashboardCard className="flex h-full flex-col">
      <div className="mb-2">
        <DashboardCardTitle>Sales by Source</DashboardCardTitle>
        <DashboardCardDescription>Share of total sales</DashboardCardDescription>
      </div>
      <div className="relative mx-auto h-[180px] w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={affsenseSalesBySource}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={0}
            >
              {affsenseSalesBySource.map((slice, index) => (
                <Cell
                  key={slice.name}
                  fill={index === 0 ? "var(--theme-chart-1)" : slice.color}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-foreground">{affsenseSalesTotal}</span>
          <span className="text-xs text-muted-foreground">Total</span>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {affsenseSalesBySource.map((slice, index) => (
          <li key={slice.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: index === 0 ? "var(--theme-chart-1)" : slice.color,
                }}
              />
              {slice.name}
            </span>
            <span className="font-semibold text-foreground">{slice.value}%</span>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
