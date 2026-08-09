"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { PlatformLogo } from "@/components/brand/platform-logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SidebarNavList, SidebarStatusCard } from "./sidebar-nav-list";
import { useNavigationPending } from "./navigation-pending";

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
        className="w-[min(100%,20rem)] gap-0 border-0 p-0 text-white [&_[data-slot=sheet-close]]:text-white sm:max-w-xs"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, var(--theme-sidebar-from), var(--theme-sidebar-to))",
        }}
      >
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-4 pr-12">
            <Link
              href="/"
              prefetch={true}
              onClick={() => {
                startNavigation();
                onOpenChange(false);
              }}
              className="flex items-center"
            >
              <PlatformLogo variant="sidebar" />
            </Link>
          </div>
          <SidebarNavList
            role={role}
            canAccessCpaOffers={canAccessCpaOffers}
            canAccessAutoresponder={canAccessAutoresponder}
            staffMenuAccess={staffMenuAccess}
            onNavigate={() => onOpenChange(false)}
          />
          <SidebarStatusCard />
        </div>
      </SheetContent>
    </Sheet>
  );
}
