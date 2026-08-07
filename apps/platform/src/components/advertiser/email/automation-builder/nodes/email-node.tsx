"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertCircle, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailNodeData } from "../flow-adapters";

function EmailNodeComponent({ data }: NodeProps) {
  const d = data as EmailNodeData;
  return (
    <div
      className={cn(
        "min-w-[220px] max-w-[260px] rounded-2xl border bg-white px-4 py-3 shadow-sm transition-shadow",
        d.hasError
          ? "border-red-300 ring-2 ring-red-500/15"
          : d.selected
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-slate-200 hover:border-slate-300",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2.5 !border-2 !border-white !bg-slate-400"
      />
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Mail className="size-3.5" />
          </span>
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Email {d.order}
          </span>
        </div>
        {d.hasError ? (
          <AlertCircle className="size-3.5 text-red-500" />
        ) : null}
      </div>
      <p className="truncate text-sm font-semibold text-slate-900">{d.templateName}</p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2.5 !border-2 !border-white !bg-emerald-500"
      />
    </div>
  );
}

export const EmailNode = memo(EmailNodeComponent);
