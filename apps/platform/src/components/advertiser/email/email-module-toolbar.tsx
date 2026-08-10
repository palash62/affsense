"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EmailToolbarFilter = {
  id: string;
  label: string;
  options: { value: string; label: string }[];
};

export type EmailToolbarAction = {
  label: string;
  icon?: LucideIcon;
  href?: string;
  variant?: "default" | "outline" | "secondary";
};

interface EmailModuleToolbarProps {
  searchPlaceholder?: string;
  filters?: EmailToolbarFilter[];
  primaryAction?: EmailToolbarAction;
  secondaryActions?: EmailToolbarAction[];
  search?: string;
  onSearchChange?: (value: string) => void;
  filterValues?: Record<string, string>;
  onFilterChange?: (id: string, value: string) => void;
}

export function EmailModuleToolbar({
  searchPlaceholder = "Search…",
  filters = [],
  primaryAction,
  secondaryActions = [],
  search: controlledSearch,
  onSearchChange,
  filterValues: controlledFilterValues,
  onFilterChange,
}: EmailModuleToolbarProps) {
  const search = controlledSearch ?? "";
  const filterValues = controlledFilterValues ?? {};

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filters.map((filter) => (
          <Select
            key={filter.id}
            value={filterValues[filter.id] ?? "all"}
            onValueChange={(v) => onFilterChange?.(filter.id, v ?? "all")}
          >
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {filter.label}</SelectItem>
              {filter.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {secondaryActions.map((action) => {
          const Icon = action.icon;
          const btn = (
            <>
              {Icon && <Icon className="mr-2 h-4 w-4" />}
              {action.label}
            </>
          );
          return action.href ? (
            <ButtonLink key={action.label} href={action.href} variant={action.variant ?? "outline"} size="sm">
              {btn}
            </ButtonLink>
          ) : (
            <Button key={action.label} type="button" variant={action.variant ?? "outline"} size="sm">
              {btn}
            </Button>
          );
        })}
        {primaryAction &&
          (primaryAction.href ? (
            <ButtonLink href={primaryAction.href} size="sm">
              {primaryAction.icon && <primaryAction.icon className="mr-2 h-4 w-4" />}
              {primaryAction.label}
            </ButtonLink>
          ) : (
            <Button type="button" size="sm">
              {primaryAction.icon && <primaryAction.icon className="mr-2 h-4 w-4" />}
              {primaryAction.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
