"use client";

import { memo, useCallback, type MouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { Plus } from "lucide-react";

type InsertEdgeData = {
  insertIndex?: number;
  onInsert?: (index: number) => void;
  readOnly?: boolean;
};

function InsertEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
  });
  const d = (data ?? {}) as InsertEdgeData;

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (typeof d.insertIndex === "number" && d.onInsert) {
        d.onInsert(d.insertIndex);
      }
    },
    [d],
  );

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {!d.readOnly ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="nodrag nopan absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-700 shadow-sm transition hover:scale-105 hover:border-emerald-400 hover:bg-emerald-50"
            style={{ left: labelX, top: labelY, pointerEvents: "all" }}
            onClick={onClick}
            aria-label="Add action"
          >
            <Plus className="size-3.5" />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const InsertEdge = memo(InsertEdgeComponent);
