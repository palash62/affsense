"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNavForRole, type NavItem } from "./nav-config";
import { SidebarNavLink } from "./sidebar-nav-link";
import { useNavigationPending } from "./navigation-pending";

function isRootHref(href: string) {
  return href === "/admin" || href === "/advertiser" || href === "/publisher";
}

/** True when pathname belongs under this nav item (prefix match, excluding role roots). */
function isItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (isRootHref(href)) return false;
  if (href === "/publisher/postback") {
    return pathname === "/publisher/postback" || pathname.startsWith("/publisher/postback/");
  }
  return pathname.startsWith(href);
}

/** Child active rules for CPA Offers submenu. */
function isChildActive(pathname: string, child: NavItem, siblings: NavItem[]) {
  if (child.href === "/admin/cpa-offers") {
    return pathname === "/admin/cpa-offers";
  }
  if (child.href === "/admin/cpa-offers/offers") {
    return (
      pathname === "/admin/cpa-offers/offers" ||
      pathname.startsWith("/admin/cpa-offers/offers/") ||
      pathname === "/admin/cpa-offers/new" ||
      /^\/admin\/cpa-offers\/[^/]+\/edit$/.test(pathname)
    );
  }
  if (child.href === "/admin/cpa-offers/report") {
    return pathname === "/admin/cpa-offers/report" || pathname.startsWith("/admin/cpa-offers/report/");
  }
  if (child.href === "/admin/cpa-offers/payouts") {
    return pathname === "/admin/cpa-offers/payouts" || pathname.startsWith("/admin/cpa-offers/payouts/");
  }
  if (child.href === "/admin/global-postback") {
    return pathname === "/admin/global-postback" || pathname.startsWith("/admin/global-postback/");
  }
  if (child.href === "/advertiser/cpa-offers/dashboard") {
    return pathname === "/advertiser/cpa-offers/dashboard" || pathname.startsWith("/advertiser/cpa-offers/dashboard/");
  }
  if (child.href === "/advertiser/cpa-offers/report") {
    return pathname === "/advertiser/cpa-offers/report" || pathname.startsWith("/advertiser/cpa-offers/report/");
  }
  if (child.href === "/advertiser/cpa-offers/wallet") {
    return pathname === "/advertiser/cpa-offers/wallet" || pathname.startsWith("/advertiser/cpa-offers/wallet/");
  }
  if (child.href === "/advertiser/cpa-offers") {
    return (
      pathname === "/advertiser/cpa-offers" ||
      (pathname.startsWith("/advertiser/cpa-offers/") &&
        !pathname.startsWith("/advertiser/cpa-offers/dashboard") &&
        !pathname.startsWith("/advertiser/cpa-offers/report") &&
        !pathname.startsWith("/advertiser/cpa-offers/wallet"))
    );
  }
  if (child.href === "/advertiser/global-postback") {
    return (
      pathname === "/advertiser/global-postback" ||
      pathname.startsWith("/advertiser/global-postback/")
    );
  }
  // Generic fallback: exact or prefix, but not claiming a sibling's more-specific path
  if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
    const claimedBySibling = siblings.some(
      (s) =>
        s.href !== child.href &&
        s.href.length > child.href.length &&
        (pathname === s.href || pathname.startsWith(`${s.href}/`)),
    );
    return !claimedBySibling;
  }
  return false;
}

function isGroupActive(pathname: string, item: NavItem) {
  if (!item.children?.length) return isItemActive(pathname, item.href);
  return item.children.some((child) => isChildActive(pathname, child, item.children!));
}

function NavGroup({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { startNavigation } = useNavigationPending();
  const children = item.children ?? [];
  const groupActive = isGroupActive(pathname, item);
  const [open, setOpen] = useState(groupActive);

  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive, pathname]);

  const ParentIcon = item.icon;

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 outline-none",
            groupActive
              ? "bg-white shadow-sm text-[var(--theme-sidebar-active-text)]"
              : "text-blue-100/90 hover:bg-white/10 hover:text-white",
          )}
          aria-label={item.label}
        >
          <ParentIcon className="h-4 w-4 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          className="min-w-[11rem] rounded-xl border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {item.label}
          </p>
          {children.map((child) => {
            const ChildIcon = child.icon;
            const active = isChildActive(pathname, child, children);
            return (
              <DropdownMenuItem
                key={child.href + child.label}
                className={cn(
                  "cursor-pointer gap-2 rounded-lg",
                  active && "bg-slate-100 font-medium text-slate-900",
                )}
                render={
                  <Link
                    href={child.href}
                    prefetch
                    onClick={() => {
                      startNavigation();
                      onNavigate?.();
                    }}
                  />
                }
              >
                <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                {child.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          groupActive
            ? "bg-white/15 text-white"
            : "text-blue-100/90 hover:bg-white/10 hover:text-white",
        )}
      >
        <ParentIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 opacity-70 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-3 space-y-0.5 border-l border-white/15 py-0.5 pl-2">
            {children.map((child) => {
              const ChildIcon = child.icon;
              const active = isChildActive(pathname, child, children);
              return (
                <Link
                  key={child.href + child.label}
                  href={child.href}
                  prefetch
                  onClick={() => {
                    startNavigation();
                    onNavigate?.();
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                    active
                      ? "bg-white shadow-sm text-[var(--theme-sidebar-active-text)]"
                      : "text-blue-100/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-90" />
                  <span>{child.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidebarNavList({
  role,
  collapsed,
  onNavigate,
  canAccessCpaOffers,
  canAccessAutoresponder,
  staffMenuAccess,
}: {
  role: UserRole;
  collapsed?: boolean;
  onNavigate?: () => void;
  canAccessCpaOffers?: boolean;
  canAccessAutoresponder?: boolean;
  staffMenuAccess?: string[];
}) {
  const pathname = usePathname();
  const items = getNavForRole(role, {
    canAccessCpaOffers,
    canAccessAutoresponder,
    staffMenuAccess,
  });

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
      {items.map((item) => {
        if (item.children?.length) {
          return (
            <NavGroup
              key={item.href + item.label}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          );
        }

        const active = isItemActive(pathname, item.href);

        return (
          <div key={item.href} onClick={onNavigate}>
            <SidebarNavLink
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={active}
              collapsed={collapsed}
            />
          </div>
        );
      })}
    </nav>
  );
}

export function SidebarStatusCard() {
  return (
    <div className="mx-3 mb-4 rounded-xl border border-white/10 bg-white/5 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-blue-200/80">
        Platform Status
      </p>
      <p className="mt-1 text-sm font-medium text-white">All systems operational</p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full w-4/5 rounded-full"
          style={{ backgroundColor: "var(--theme-success)" }}
        />
      </div>
    </div>
  );
}
