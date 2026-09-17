"use client";

import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button-link";
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
  const ActionIcon = primaryAction?.icon;

  return (
    <div className="space-y-6">
      {showHero ? (
        <PageHeader title={title} description={description} breadcrumbs={breadcrumbs}>
          {primaryAction?.href && ActionIcon ? (
            <ButtonLink
              href={primaryAction.href}
              className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm text-white hover:opacity-90"
            >
              <ActionIcon className="mr-2 h-4 w-4" />
              {primaryAction.label}
            </ButtonLink>
          ) : null}
        </PageHeader>
      ) : null}

      {stats && stats.length > 0 && <EmailModuleStats stats={stats} />}

      {showToolbar &&
      (searchPlaceholder || filters?.length || primaryAction || secondaryActions?.length) ? (
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
      ) : null}

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
