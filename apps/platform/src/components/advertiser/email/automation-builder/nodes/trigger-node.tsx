"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriggerNodeData } from "../flow-adapters";

function TriggerNodeComponent({ data }: NodeProps) {
  const d = data as TriggerNodeData;
  const hasTags = Boolean(d.openTagName || d.clickTagName);
  return (
    <div
      className={cn(
        "min-w-[200px] rounded-2xl border bg-card px-4 py-3 shadow-sm transition-shadow",
        d.selected
          ? "border-emerald-500 ring-2 ring-emerald-500/20"
          : "border-border hover:border-border",
      )}
    >
      <div className={cn("flex items-center gap-2", hasTags && "mb-1.5")}>
        <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
          <Zap className="size-3.5" />
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          {d.title}
        </span>
      </div>
      {d.openTagName ? (
        <p className="truncate text-[11px] text-amber-700">Open: {d.openTagName}</p>
      ) : null}
      {d.clickTagName ? (
        <p className="truncate text-[11px] text-amber-700">Click: {d.clickTagName}</p>
      ) : null}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-2 !border-white !bg-emerald-500"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
