"use client";

import { CheckCircle2, Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FunnelStepId, FunnelStepItem } from "./funnel-types";

type FunnelStepsSidebarProps = {
  steps: FunnelStepItem[];
  activeStepId: FunnelStepId;
  onSelectStep: (id: FunnelStepId) => void;
  onAddStep: () => void;
};

export function FunnelStepsSidebar({
  steps,
  activeStepId,
  onSelectStep,
  onAddStep,
}: FunnelStepsSidebarProps) {
  const enabledCount = steps.filter((s) => s.enabled).length;

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        <span className="text-sm font-medium text-foreground">Funnel steps</span>
        {enabledCount > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{enabledCount} step{enabledCount === 1 ? "" : "s"}</span>
        )}
      </div>

      <div className="space-y-1">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            disabled={!step.enabled}
            onClick={() => step.enabled && onSelectStep(step.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition",
              !step.enabled && "cursor-not-allowed opacity-45",
              activeStepId === step.id && step.enabled
                ? "bg-blue-50 font-medium text-blue-900 ring-1 ring-blue-200"
                : step.enabled
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground",
            )}
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate capitalize">{step.name}</span>
          </button>
        ))}
      </div>

      <Button className="mt-4 w-full" onClick={onAddStep}>
        <Plus className="mr-2 h-4 w-4" />
        Add new step or import
      </Button>
    </div>
  );
}
