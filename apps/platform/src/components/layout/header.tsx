"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { signOut, useSession } from "next-auth/react";
import {
  Bell,
  Search,
  LogOut,
  User,
  Zap,
  Megaphone,
  Menu,
  PlayCircle,
  UserPlus,
  PackagePlus,
  Store,
  ClipboardList,
  BarChart3,
  ChevronDown,
  Wallet,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { shouldShowAdminQuickActions } from "@/lib/header-quick-actions";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { getPublisherPageMeta, isPublisherPortalRole } from "@/lib/publisher-page-title";
import { getAdminPageMeta, getAdminRoleLabel } from "@/lib/admin-page-title";
import { cn } from "@/lib/utils";
import type { UserRole } from "@prisma/client";

interface HeaderProps {
  role: UserRole;
  title?: string;
  breadcrumbs?: string[];
  premium?: boolean;
  onOpenMobileNav?: () => void;
}

const publisherQuickLinks = [
  { label: "Request Payout", href: "/publisher/payouts/request", icon: Wallet },
  { label: "Payment History", href: "/publisher/transactions", icon: Receipt },
  { label: "Marketing Materials", href: "/publisher/marketplace", icon: PackagePlus },
  { label: "Leaderboard", href: "/publisher/reports/performance", icon: BarChart3 },
];

const quickActionLinks = [
  { label: "Add New User", href: "/admin/advertisers", icon: UserPlus },
  { label: "Add New Product", href: "/admin/campaigns", icon: PackagePlus },
  { label: "Create CPA Offer", href: "/admin/cpa-offers", icon: Store },
  { label: "Add Quick Task", href: "/admin/campaigns", icon: ClipboardList },
  { label: "Send Announcement", href: "/admin/bulk-email", icon: Megaphone },
  { label: "View All Reports", href: "/admin/reports", icon: BarChart3 },
];

async function handleSignOut() {
  // Stay on the current origin — NextAuth resolves relative callbackUrl against AUTH_URL,
  // which may still point at production after a production build or env:production run.
  await signOut({ redirect: false });
  window.location.assign("/login");
}

export function Header({ role, title, breadcrumbs, premium, onOpenMobileNav }: HeaderProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "U";

  const firstName = session?.user?.name?.split(" ")[0] ?? "Admin";
  const affsenseAdmin = isAdminPortalRole(role);
  const affsensePublisher = isPublisherPortalRole(role);
  const pageMeta = affsenseAdmin
    ? getAdminPageMeta(pathname, firstName)
    : affsensePublisher
      ? getPublisherPageMeta(pathname, firstName)
      : { title: title ?? "", subtitle: undefined as string | undefined };
  const displayTitle = affsenseAdmin || affsensePublisher ? pageMeta.title : title;
  const displaySubtitle =
    affsenseAdmin || affsensePublisher ? pageMeta.subtitle : undefined;
  const roleLabel = affsensePublisher ? "Elite Affiliate" : getAdminRoleLabel(role);

  const notificationsHref =
    role === "ADMIN" || role === "PLATFORM_MANAGER"
      ? "/admin/notifications"
      : role === "ADVERTISER"
        ? "/advertiser/notifications"
        : "/publisher/notifications";

  const tutorialsHref =
    role === "ADMIN" || role === "PLATFORM_MANAGER"
      ? "/admin/tutorials"
      : role === "ADVERTISER"
        ? "/advertiser/tutorials"
        : null;

  const showQuickActions = premium && shouldShowAdminQuickActions(role);
  const showPublisherQuickLinks = affsensePublisher;
  const showTutorial = Boolean(tutorialsHref) && !affsenseAdmin && !affsensePublisher;
  const showTheme = Boolean(premium) && !affsenseAdmin && !affsensePublisher;
  const affsenseChrome = affsenseAdmin || affsensePublisher;

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-8",
        affsenseChrome ? "h-18 border-b border-border bg-card" : "h-[4.25rem]",
        !affsenseChrome &&
          (premium
            ? "border-b border-border/60 bg-card/90 backdrop-blur-md"
            : "border-b border-border bg-card"),
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {onOpenMobileNav ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10 shrink-0 rounded-md text-foreground hover:bg-muted lg:hidden"
            onClick={onOpenMobileNav}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}
        <div className="min-w-0">
          {!affsenseChrome && breadcrumbs && breadcrumbs.length > 0 && (
            <p className="truncate text-xs text-muted-foreground">{breadcrumbs.join(" / ")}</p>
          )}
          {displayTitle ? (
            <h1
              className={cn(
                "truncate font-semibold text-foreground",
                affsenseChrome ? "text-2xl font-bold tracking-tight" : "text-lg",
              )}
            >
              {displayTitle}
            </h1>
          ) : null}
          {displaySubtitle ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{displaySubtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <div className="relative hidden md:block">
          <Input
            placeholder="Search anything..."
            className={cn(
              "h-10 rounded-full border-border bg-muted/80 text-sm shadow-sm transition-colors focus:bg-card",
              affsenseChrome ? "w-80 pr-10 pl-4" : "w-72 pl-10",
              !premium && !affsenseChrome && "w-64",
            )}
          />
          <Search
            className={cn(
              "absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
              affsenseChrome ? "right-3.5" : "left-3.5",
            )}
          />
        </div>

        {showTutorial && tutorialsHref && (
          <ButtonLink
            href={tutorialsHref}
            size="sm"
            className="h-10 gap-1.5 rounded-xl border border-red-600 bg-red-600 px-3.5 text-white shadow-sm transition-colors hover:bg-red-700 hover:border-red-700"
          >
            <PlayCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Tutorial</span>
          </ButtonLink>
        )}

        {showPublisherQuickLinks && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-10 gap-2 rounded-md border-border bg-card px-3.5 text-foreground shadow-sm hover:bg-muted sm:flex"
                />
              }
            >
              <Zap className="h-4 w-4 text-[var(--theme-primary)]" />
              Quick Links
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-[var(--radius-card,0.875rem)]">
              {publisherQuickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showQuickActions && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden h-10 gap-2 rounded-md border-border bg-card px-3.5 text-foreground shadow-sm hover:bg-muted sm:flex"
                />
              }
            >
              <Zap className="h-4 w-4 text-[var(--theme-primary)]" />
              Quick Actions
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-[var(--radius-card,0.875rem)]">
              {quickActionLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem key={item.label} render={<Link href={item.href} />}>
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {showTheme && <ThemeSwitcher />}

        <ButtonLink
          href={notificationsHref}
          variant="ghost"
          size="icon"
          className={cn(
            "relative size-10 rounded-md text-muted-foreground hover:bg-muted",
            (premium || affsenseChrome) && "border border-border bg-card shadow-sm",
          )}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {affsenseChrome && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              12
            </span>
          )}
        </ButtonLink>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(
                  "relative h-auto gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted",
                  (premium || affsenseChrome) && "border border-border bg-card pr-2.5 shadow-sm",
                )}
              />
            }
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold",
                  premium || affsenseChrome
                    ? "bg-[var(--theme-primary)] text-white"
                    : "bg-primary/10 text-primary",
                )}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            {affsenseChrome ? (
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {session?.user?.name ?? "Admin User"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{roleLabel}</span>
              </span>
            ) : premium ? (
              <span className="hidden text-sm font-medium text-foreground lg:inline">
                {session?.user?.name?.split(" ")[0]}
              </span>
            ) : null}
            {affsenseChrome && (
              <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-[var(--radius-card,0.875rem)]">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
