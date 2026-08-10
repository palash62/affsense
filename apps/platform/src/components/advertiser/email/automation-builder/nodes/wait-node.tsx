"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaitNodeData } from "../flow-adapters";

function WaitNodeComponent({ data }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <div
      className={cn(
        "min-w-[200px] max-w-[240px] rounded-2xl border bg-card px-4 py-3 shadow-sm transition-shadow",
        d.selected
          ? "border-violet-500 ring-2 ring-violet-500/20"
          : "border-border hover:border-border",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-white !bg-slate-400"
      />
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <Clock className="size-3.5" />
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Wait
        </span>
      </div>
      <p className="text-sm font-semibold text-foreground">{d.waitLabel}</p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-2 !border-white !bg-violet-500"
      />
    </div>
  );
}

export const WaitNode = memo(WaitNodeComponent);
