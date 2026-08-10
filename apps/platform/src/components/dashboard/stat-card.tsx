import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "group premium-card border-t-[3px] border-t-[var(--theme-primary)] p-5 transition-all duration-300 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
          <Icon className="h-5 w-5 text-[var(--theme-primary)]" />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trendUp ? "text-[var(--theme-success)]" : "text-destructive",
            )}
          >
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}
