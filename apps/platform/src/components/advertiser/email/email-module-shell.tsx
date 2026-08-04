"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { RoleHero } from "@/components/layout/role-hero";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { EmailModuleFilterProvider, useEmailModuleFilters } from "./email-module-filter-context";
import { EmailModuleStats, type EmailStatItem } from "./email-module-stats";
import {
  EmailModuleToolbar,
  type EmailToolbarAction,
  type EmailToolbarFilter,
} from "./email-module-toolbar";

export type EmailBreadcrumb = { label: string; href?: string };

export interface EmailModuleShellProps {
  title: string;
  description: string;
  breadcrumbs: EmailBreadcrumb[];
  primaryAction?: EmailToolbarAction & { icon?: LucideIcon };
  secondaryActions?: EmailToolbarAction[];
  stats?: EmailStatItem[];
  searchPlaceholder?: string;
  filters?: EmailToolbarFilter[];
  initialFilterValues?: Record<string, string>;
  showHero?: boolean;
  showToolbar?: boolean;
  children: React.ReactNode;
}

function EmailModuleShellInner({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  stats,
  searchPlaceholder,
  filters,
  showHero = true,
  showToolbar = true,
  children,
}: Omit<EmailModuleShellProps, "initialFilterValues">) {
  const { search, filterValues, setSearch, setFilterValue } = useEmailModuleFilters();

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.label} className="contents">
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {crumb.href && i < breadcrumbs.length - 1 ? (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </span>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {showHero && (
        <RoleHero
          eyebrow="Autoresponder"
          title={title}
          description={description}
          action={
            primaryAction?.href && primaryAction.icon
              ? { label: primaryAction.label, href: primaryAction.href, icon: primaryAction.icon }
              : undefined
          }
        />
      )}

      {stats && stats.length > 0 && <EmailModuleStats stats={stats} />}

      {showToolbar && (searchPlaceholder || filters?.length || primaryAction || secondaryActions?.length) && (
        <EmailModuleToolbar
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          primaryAction={showHero ? undefined : primaryAction}
          secondaryActions={secondaryActions}
          search={search}
          onSearchChange={setSearch}
          filterValues={filterValues}
          onFilterChange={setFilterValue}
        />
      )}

      {children}
    </div>
  );
}

export function EmailModuleShell({ initialFilterValues, ...props }: EmailModuleShellProps) {
  return (
    <EmailModuleFilterProvider initialFilterValues={initialFilterValues}>
      <EmailModuleShellInner {...props} />
    </EmailModuleFilterProvider>
  );
}
