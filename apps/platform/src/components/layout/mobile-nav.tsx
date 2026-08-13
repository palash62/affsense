"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { isPublisherPortalRole } from "@/lib/publisher-page-title";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNavList, SidebarStatusCard, SidebarAffiliateTierCard } from "./sidebar-nav-list";
import { useNavigationPending } from "./navigation-pending";
import { cn } from "@/lib/utils";

export function MobileNav({
  role,
  open,
  onOpenChange,
  canAccessCpaOffers,
  canAccessAutoresponder,
  staffMenuAccess,
}: {
  role: UserRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAccessCpaOffers?: boolean;
  canAccessAutoresponder?: boolean;
  staffMenuAccess?: string[];
}) {
  const pathname = usePathname();
  const { startNavigation } = useNavigationPending();
  const affsenseChrome = isAdminPortalRole(role) || isPublisherPortalRole(role);

  useEffect(() => {
    onOpenChange(false);
    // Close when the route changes (e.g. after navigating).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only pathname
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton
        className={cn(
          "w-[min(100%,20rem)] gap-0 border-0 p-0 text-white [&_[data-slot=sheet-close]]:text-white sm:max-w-xs",
          affsenseChrome && "bg-[var(--theme-sidebar-from)]",
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
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div
            className={cn(
              "flex shrink-0 items-center px-4 pr-12",
              affsenseChrome
                ? "h-18 border-b border-white/5"
                : "h-16 border-b border-white/10",
            )}
          >
            <Link
              href={affsenseChrome ? (isPublisherPortalRole(role) ? "/publisher" : "/admin") : "/"}
              prefetch={true}
              onClick={() => {
                startNavigation();
                onOpenChange(false);
              }}
              className="flex items-center"
            >
              <PlatformLogo variant="sidebar" adminPanel={affsenseChrome} />
            </Link>
          </div>
          <SidebarNavList
            role={role}
            canAccessCpaOffers={canAccessCpaOffers}
            canAccessAutoresponder={canAccessAutoresponder}
            staffMenuAccess={staffMenuAccess}
            onNavigate={() => onOpenChange(false)}
          />
          {isPublisherPortalRole(role) ? <SidebarAffiliateTierCard /> : <SidebarStatusCard />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
