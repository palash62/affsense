"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AddActionNodeData } from "../flow-adapters";

function AddActionNodeComponent({ data }: NodeProps) {
  const d = data as AddActionNodeData;
  return (
    <div
      className={cn(
        "flex min-w-[160px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-5 transition-colors",
        d.disabled
          ? "cursor-not-allowed border-border bg-muted text-muted-foreground"
          : "cursor-pointer border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-white !bg-slate-400"
      />
      <span
        className={cn(
          "mb-2 flex size-9 items-center justify-center rounded-full border",
          d.disabled
            ? "border-border bg-white"
            : "border-emerald-200 bg-card text-emerald-600",
        )}
      >
        <Plus className="size-4" />
      </span>
      <p className="text-center text-xs font-semibold">{d.label}</p>
    </div>
  );
}

export const AddActionNode = memo(AddActionNodeComponent);
