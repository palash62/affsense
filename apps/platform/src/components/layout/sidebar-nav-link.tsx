"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigationPending } from "./navigation-pending";

interface SidebarNavLinkProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed?: boolean;
}

function SidebarNavLinkContent({
  label,
  icon: Icon,
  active,
  collapsed,
}: Omit<SidebarNavLinkProps, "href">) {
  const { pending } = useLinkStatus();

  return (
    <>
      <Icon className={cn("h-4 w-4 shrink-0", pending && "animate-pulse")} />
      {!collapsed && (
        <span className={cn("flex-1", pending && "opacity-70")}>{label}</span>
      )}
      {pending && !collapsed && (
        <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-card/80" />
      )}
      <span className="sr-only">{active ? `${label}, current page` : label}</span>
    </>
  );
}

export function SidebarNavLink({
  href,
  label,
  icon,
  active,
  collapsed,
}: SidebarNavLinkProps) {
  const { startNavigation } = useNavigationPending();

  return (
    <Link
      href={href}
      prefetch={true}
      onClick={() => startNavigation()}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "sidebar-nav-link-active bg-gradient-to-r from-[var(--theme-sidebar-active-from)] to-[var(--theme-sidebar-active-to)] text-[var(--theme-sidebar-active-text)] shadow-sm"
          : "text-white/60 hover:bg-white/[0.06] hover:text-white [&_svg]:text-white/50 hover:[&_svg]:text-white",
      )}
    >
      <SidebarNavLinkContent
        label={label}
        icon={icon}
        active={active}
        collapsed={collapsed}
      />
    </Link>
  );
}
