import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Box, ClipboardList, LayoutGrid, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardOfferSource = "digital" | "cpa" | "offerwall" | "tasks";

const SOURCE_STYLES: Record<DashboardOfferSource, { icon: LucideIcon; className: string }> = {
  digital: { icon: Box, className: "bg-emerald-50 text-emerald-600" },
  cpa: { icon: Target, className: "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]" },
  offerwall: { icon: LayoutGrid, className: "bg-blue-50 text-blue-600" },
  tasks: { icon: ClipboardList, className: "bg-amber-50 text-amber-600" },
};

export function DashboardSourceChip({ source }: { source: DashboardOfferSource }) {
  const { icon: Icon, className } = SOURCE_STYLES[source];
  return (
    <span
      className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", className)}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function DashboardViewAllLink({ href }: { href: string }) {
  return (
    <Link href={href} className="text-xs font-semibold text-[var(--theme-primary)] hover:underline">
      View All
    </Link>
  );
}
