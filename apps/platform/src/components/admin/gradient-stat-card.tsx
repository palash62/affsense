import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const gradientStyles = {
  revenue: "var(--theme-gradient-revenue)",
  leads: "var(--theme-gradient-leads)",
  approved: "var(--theme-gradient-approved)",
} as const;

export type GradientVariant = keyof typeof gradientStyles;

interface GradientStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  variant: GradientVariant;
  trend?: number;
  className?: string;
}

export function GradientStatCard({
  label,
  value,
  icon: Icon,
  variant,
  trend,
  className,
}: GradientStatCardProps) {
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[18px] p-5 text-white shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
      style={{ background: gradientStyles[variant] }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="relative mt-5">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  );
}

const accentStyles = {
  purple: {
    border: "border-t-purple-500",
    icon: "bg-purple-50 text-purple-600",
  },
  green: {
    border: "border-t-emerald-500",
    icon: "bg-emerald-50 text-emerald-600",
  },
  orange: {
    border: "border-t-orange-500",
    icon: "bg-orange-50 text-orange-600",
  },
  red: {
    border: "border-t-red-500",
    icon: "bg-red-50 text-red-600",
  },
} as const;

export type AccentVariant = keyof typeof accentStyles;

interface NeutralStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: AccentVariant;
  trend?: number;
  className?: string;
}

export function NeutralStatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  className,
}: NeutralStatCardProps) {
  const styles = accentStyles[accent];
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <div
      className={cn(
        "group rounded-[18px] border border-border border-t-[3px] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
        styles.border,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-105",
            styles.icon,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trendUp ? "text-emerald-600" : "text-red-500",
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
