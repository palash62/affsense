"use client";

import { Home, LayoutGrid, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FunnelListToolbarProps = {
  search: string;
  searchPlaceholder?: string;
  onSearchChange: (value: string) => void;
};

export function FunnelListToolbar({
  search,
  searchPlaceholder = "Search for funnels",
  onSearchChange,
}: FunnelListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled>
          <Home className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 sm:max-w-md">
        <Button variant="ghost" size="icon" className={cn("h-8 w-8 text-blue-600")}>
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-border bg-white pl-9"
          />
        </div>
      </div>
    </div>
  );
}
