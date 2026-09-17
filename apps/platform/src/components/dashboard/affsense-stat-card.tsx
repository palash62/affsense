import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { DashboardCard } from "@/components/admin/affsense-dashboard/dashboard-card";
import { cn } from "@/lib/utils";

export type AffsenseStatAccent = "coral" | "emerald" | "amber" | "navy" | "danger";

export const affsenseStatAccentStyles: Record<
  AffsenseStatAccent,
  { stripe: string; chip: string; icon: string }
> = {
  coral: {
    stripe: "border-t-[var(--theme-primary)]",
    chip: "bg-[var(--theme-primary-soft)]",
    icon: "text-[var(--theme-primary)]",
  },
  emerald: {
    stripe: "border-t-[var(--theme-success)]",
    chip: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)]",
    icon: "text-[var(--theme-success)]",
  },
  amber: {
    stripe: "border-t-[var(--warning)]",
    chip: "bg-[color-mix(in_srgb,var(--warning)_14%,white)]",
    icon: "text-[var(--warning)]",
  },
  navy: {
    stripe: "border-t-[var(--secondary)]",
    chip: "bg-[color-mix(in_srgb,var(--secondary)_10%,white)]",
    icon: "text-[var(--secondary)]",
  },
  danger: {
    stripe: "border-t-destructive",
    chip: "bg-destructive/10",
    icon: "text-destructive",
  },
};

export type AffsenseStatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: AffsenseStatAccent;
  trend?: number;
  valueClassName?: string;
  footer?: {
    sub?: string;
    href?: string;
    linkLabel?: string;
  };
  className?: string;
};

export function AffsenseStatCard({
  label,
  value,
  icon: Icon,
  accent = "coral",
  trend,
  valueClassName,
  footer,
  className,
}: AffsenseStatCardProps) {
  const styles = affsenseStatAccentStyles[accent];
  const trendUp = trend !== undefined && trend >= 0;
  const showFooter = Boolean(footer?.sub || (footer?.href && footer?.linkLabel));

  return (
    <DashboardCard
      className={cn(
        "flex flex-col border-t-[3px] bg-gradient-to-br from-card to-muted/40 p-4 transition-all duration-200 hover:shadow-[var(--shadow-card-hover)]",
        styles.stripe,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-xs font-medium tracking-normal text-muted-foreground">{label}</p>
        <div className="flex shrink-0 items-start gap-2">
          {trend !== undefined ? (
            <span
              className={cn(
                "mt-0.5 flex items-center gap-0.5 text-xs font-semibold",
                trendUp ? "text-[var(--theme-success)]" : "text-destructive",
              )}
            >
              {trendUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend)}%
            </span>
          ) : null}
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              styles.chip,
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", styles.icon)} />
          </div>
        </div>
      </div>

      <p
        className={cn("mt-3 font-bold tracking-normal text-foreground", valueClassName)}
        style={{ fontSize: "var(--type-metric)" }}
      >
        {typeof value === "number" ? value.toLocaleString("en-US") : value}
      </p>

      {showFooter ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/80 pt-2.5">
          {footer?.sub ? (
            <span className="text-xs font-medium tracking-normal text-muted-foreground">
              {footer.sub}
            </span>
          ) : (
            <span />
          )}
          {footer?.href && footer?.linkLabel ? (
            <Link
              href={footer.href}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[var(--theme-primary)] hover:underline"
            >
              {footer.linkLabel}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </DashboardCard>
  );
}
