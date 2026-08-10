"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GripVertical, Plus, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FunnelStepId } from "@/components/advertiser/funnel/funnel-types";
import { useBuilderStore } from "@/modules/page-builder/lib/builder-store";

type StepOption = {
  id: FunnelStepId;
  name: string;
  enabled: boolean;
};

type FunnelStepsPopoverProps = {
  funnelId: string;
  steps: StepOption[];
  currentStepId: FunnelStepId;
  currentStepLabel: string;
};

export function FunnelStepsPopover({
  funnelId,
  steps,
  currentStepId,
  currentStepLabel,
}: FunnelStepsPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = steps.filter(
    (s) => s.enabled && s.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function goToStep(stepId: FunnelStepId) {
    setOpen(false);
    await useBuilderStore.getState().flushSave?.();
    router.push(`${pathname}?step=${stepId}`);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-8 max-w-[180px] justify-between gap-2 border-border bg-white font-normal",
        )}
      >
        <span className="truncate capitalize">{currentStepLabel}</span>
        <span className="text-muted-foreground">▾</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <div className="border-b border-border p-3">
          <p className="mb-2 text-sm font-medium text-foreground">Steps</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-8 border-border pl-8 text-sm"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto p-2">
          {filtered.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => void goToStep(step.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                currentStepId === step.id ? "bg-blue-50 text-blue-900" : "text-foreground hover:bg-muted",
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate capitalize">{step.name}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-blue-600"
            onClick={() => {
              setOpen(false);
              void useBuilderStore.getState().flushSave?.();
                router.push(useBuilderStore.getState().builderConfig.detailPath ?? `/advertiser/optin-funnels/${funnelId}`);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add new page
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
