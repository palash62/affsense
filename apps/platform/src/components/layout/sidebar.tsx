"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { SidebarNavList, SidebarStatusCard, SidebarAffiliateTierCard } from "./sidebar-nav-list";
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
  const affsenseChrome = isAdminPortalRole(role) || isPublisherPortalRole(role);

  return (
    <aside
      className={cn(
        "hidden sticky top-0 h-dvh min-h-0 shrink-0 self-start overflow-hidden flex-col shadow-lg lg:flex",
        collapsed ? "w-16" : "w-64",
        affsenseChrome ? "bg-[var(--theme-sidebar-from)]" : "",
        className,
      )}
      style={
        affsenseChrome
          ? undefined
          : {
              backgroundImage:
                "linear-gradient(to bottom, var(--theme-sidebar-from), var(--theme-sidebar-to))",
            }
      }
    >
      <div
        className={cn(
          "flex items-center px-4",
          affsenseChrome
            ? "h-18 border-b border-white/5"
            : "h-16 border-b border-white/10",
        )}
      >
        <Link
          href={affsenseChrome ? (isPublisherPortalRole(role) ? "/publisher" : "/admin") : "/"}
          prefetch={true}
          onClick={() => startNavigation()}
          className="flex items-center"
        >
          <PlatformLogo
            collapsed={collapsed}
            variant="sidebar"
            adminPanel={affsenseChrome}
          />
        </Link>
      </div>
      <SidebarNavList
        role={role}
        collapsed={collapsed}
        canAccessCpaOffers={canAccessCpaOffers}
        canAccessAutoresponder={canAccessAutoresponder}
        staffMenuAccess={staffMenuAccess}
      />
      {!collapsed ? (
        isPublisherPortalRole(role) ? (
          <SidebarAffiliateTierCard />
        ) : (
          <SidebarStatusCard />
        )
      ) : null}
    </aside>
  );
}
