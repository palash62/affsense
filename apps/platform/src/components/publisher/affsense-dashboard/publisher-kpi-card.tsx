"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, Wallet } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { cn } from "@/lib/utils";

export type PublisherKpiAccent = "coral" | "emerald" | "amber";

const ACCENTS: Record<PublisherKpiAccent, { chip: string; icon: string; stroke: string }> = {
  coral: {
    chip: "bg-[var(--theme-primary-soft)]",
    icon: "text-[var(--theme-primary)]",
    stroke: "var(--theme-primary)",
  },
  emerald: {
    chip: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)]",
    icon: "text-[var(--theme-success)]",
    stroke: "var(--theme-success)",
  },
  amber: {
    chip: "bg-[color-mix(in_srgb,var(--warning)_14%,white)]",
    icon: "text-[var(--warning)]",
    stroke: "var(--warning)",
  },
};

const cardShell =
  "flex min-h-[124px] flex-col rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]";

export function PublisherKpiCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  note,
  sparkline,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: PublisherKpiAccent;
  trend?: number;
  note?: string;
  sparkline: number[];
}) {
  const styles = ACCENTS[accent];
  const trendUp = trend !== undefined && trend >= 0;
  const points = sparkline.map((v, i) => ({ i, v }));

  return (
    <div className={cardShell}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            styles.chip,
          )}
        >
          <Icon className={cn("h-5 w-5", styles.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        {trend !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              trendUp ? "text-[var(--theme-success)]" : "text-destructive",
            )}
          >
            {trendUp ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {Math.abs(trend)}%
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">{note}</span>
        )}
        <div className="h-9 w-20 shrink-0">
          {points.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <YAxis hide domain={["dataMin", "dataMax"]} />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={styles.stroke}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PublisherBalanceCard({ amount }: { amount: string }) {
  return (
    <div className="flex min-h-[124px] flex-col justify-between rounded-[var(--radius-card,0.875rem)] bg-gradient-to-br from-[#FF7A45] via-[#F5531F] to-[#E8380F] p-4 text-white shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-white/85">Available Balance</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{amount}</p>
        </div>
      </div>
      <p className="text-[11px] text-white/80">Ready for your next payout</p>
    </div>
  );
}
