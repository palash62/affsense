"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { SidebarNavList, SidebarStatusCard } from "./sidebar-nav-list";
import { useNavigationPending } from "./navigation-pending";

interface SidebarProps {
  role: UserRole;
  collapsed?: boolean;
  canAccessCpaOffers?: boolean;
  canAccessAutoresponder?: boolean;
  staffMenuAccess?: string[];
  className?: string;
}

export function Sidebar({
  role,
  collapsed,
  canAccessCpaOffers,
  canAccessAutoresponder,
  staffMenuAccess,
  className,
}: SidebarProps) {
  const { startNavigation } = useNavigationPending();

  return (
    <aside
      className={cn(
        "hidden sticky top-0 h-dvh shrink-0 flex-col shadow-lg lg:flex",
        collapsed ? "w-16" : "w-64",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(to bottom, var(--theme-sidebar-from), var(--theme-sidebar-to))",
      }}
    >
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <Link
          href="/"
          prefetch={true}
          onClick={() => startNavigation()}
          className="flex items-center"
        >
          <PlatformLogo collapsed={collapsed} variant="sidebar" />
        </Link>
      </div>
      <SidebarNavList
        role={role}
        collapsed={collapsed}
        canAccessCpaOffers={canAccessCpaOffers}
        canAccessAutoresponder={canAccessAutoresponder}
        staffMenuAccess={staffMenuAccess}
      />
      {!collapsed ? <SidebarStatusCard /> : null}
    </aside>
  );
}
