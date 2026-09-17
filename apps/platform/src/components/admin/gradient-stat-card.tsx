import type { LucideIcon } from "lucide-react";
import {
  AffsenseStatCard,
  type AffsenseStatAccent,
} from "@/components/dashboard/affsense-stat-card";

export type GradientVariant = "revenue" | "leads" | "approved";

const gradientAccentMap: Record<GradientVariant, AffsenseStatAccent> = {
  revenue: "coral",
  leads: "navy",
  approved: "emerald",
};

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
  icon,
  variant,
  trend,
  className,
}: GradientStatCardProps) {
  return (
    <AffsenseStatCard
      label={label}
      value={value}
      icon={icon}
      accent={gradientAccentMap[variant]}
      trend={trend}
      className={className}
    />
  );
}

export type AccentVariant = "purple" | "green" | "orange" | "red";

const accentMap: Record<AccentVariant, AffsenseStatAccent> = {
  purple: "coral",
  green: "emerald",
  orange: "amber",
  red: "danger",
};

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
  icon,
  accent,
  trend,
  className,
}: NeutralStatCardProps) {
  return (
    <AffsenseStatCard
      label={label}
      value={value}
      icon={icon}
      accent={accentMap[accent]}
      trend={trend}
      className={className}
    />
  );
}
