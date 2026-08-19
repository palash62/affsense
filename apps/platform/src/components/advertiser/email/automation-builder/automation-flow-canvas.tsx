"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { TriggerNode } from "./nodes/trigger-node";
import { WaitNode } from "./nodes/wait-node";
import { EmailNode } from "./nodes/email-node";
import { AddActionNode } from "./nodes/add-action-node";
import { InsertEdge } from "./nodes/insert-edge";
import {
  ADD_ACTION_ID,
  NODE,
  TRIGGER_ID,
  stepsToFlow,
} from "./flow-adapters";
import type { AutomationBuilderState } from "./use-automation-builder-state";

const nodeTypes: NodeTypes = {
  [NODE.trigger]: TriggerNode,
  [NODE.wait]: WaitNode,
  [NODE.email]: EmailNode,
  [NODE.addAction]: AddActionNode,
};

const edgeTypes: EdgeTypes = {
  insert: InsertEdge,
};

type Props = {
  state: AutomationBuilderState;
  flowApiRef: React.MutableRefObject<{
    fitView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    autoLayout: () => void;
  } | null>;
};

function FlowInner({ state, flowApiRef }: Props) {
  const {
    form,
    steps,
    templates,
    tags,
    selection,
    selectTrigger,
    selectEmail,
    selectWait,
    selectCanvas,
    openPicker,
    invalidStepIds,
    maxSteps,
    readOnly,
  } = state;

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const base = stepsToFlow(
      form,
      steps,
      templates,
      tags,
      selection,
      maxSteps,
      invalidStepIds,
      readOnly,
    );
    return {
      nodes: base.nodes.map((n) => {
        let selected = false;
        if (n.id === TRIGGER_ID) {
          selected = selection.kind === "trigger";
        } else if (n.id.startsWith("wait-")) {
          selected =
            selection.kind === "wait" &&
            selection.clientId === n.id.replace(/^wait-/, "");
        } else if (n.id.startsWith("email-")) {
          selected =
            selection.kind === "email" &&
            selection.clientId === n.id.replace(/^email-/, "");
        }
        return { ...n, selected };
      }),
      edges: base.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as object),
          onInsert: readOnly ? undefined : (index: number) => openPicker(index),
        },
      })),
    };
  }, [form, steps, templates, tags, selection, maxSteps, invalidStepIds, openPicker, readOnly]);

  const autoLayout = useCallback(() => {
    requestAnimationFrame(() => fitView({ padding: 0.28, duration: 300 }));
  }, [fitView]);

  useEffect(() => {
    flowApiRef.current = {
      fitView: () => fitView({ padding: 0.28, duration: 250 }),
      zoomIn: () => zoomIn({ duration: 150 }),
      zoomOut: () => zoomOut({ duration: 150 }),
      autoLayout,
    };
    return () => {
      flowApiRef.current = null;
    };
  }, [autoLayout, fitView, flowApiRef, zoomIn, zoomOut]);

  const prevCount = useRef(steps.length);
  useEffect(() => {
    if (prevCount.current !== steps.length) {
      prevCount.current = steps.length;
      requestAnimationFrame(() => fitView({ padding: 0.28, duration: 280 }));
    }
  }, [steps.length, fitView]);

  useEffect(() => {
    const t = window.setTimeout(() => fitView({ padding: 0.28 }), 50);
    return () => window.clearTimeout(t);
  }, [fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === ADD_ACTION_ID) {
        if (!readOnly) openPicker(steps.length);
        return;
      }
      if (node.id === TRIGGER_ID) {
        selectTrigger();
        return;
      }
      if (node.id.startsWith("wait-")) {
        selectWait(node.id.replace(/^wait-/, ""));
        return;
      }
      if (node.id.startsWith("email-")) {
        selectEmail(node.id.replace(/^email-/, ""));
      }
    },
    [openPicker, selectEmail, selectTrigger, selectWait, steps.length, readOnly],
  );

  const onPaneClick = useCallback(() => {
    selectCanvas();
  }, [selectCanvas]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll
      zoomOnScroll
      fitView
      minZoom={0.4}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      className="bg-[radial-gradient(ellipse_at_top,_var(--background)_0%,_#eef2f7_55%,_#e8eef5_100%)]"
      defaultEdgeOptions={{
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      }}
    >
      <Background gap={20} size={1} color="#cbd5e1" />
      <Controls
        showInteractive={false}
        className="!overflow-hidden !rounded-xl !border-border !bg-white !shadow-sm"
      />
      <MiniMap
        className="!overflow-hidden !rounded-xl !border-border !bg-card/90 !shadow-sm"
        nodeColor={(n) => {
          if (n.type === NODE.trigger) return "#f59e0b";
          if (n.type === NODE.wait) return "#8b5cf6";
          if (n.type === NODE.email) return "var(--theme-success)";
          return "#94a3b8";
        }}
        maskColor="rgb(15 23 42 / 0.08)"
      />
    </ReactFlow>
  );
}

export function AutomationFlowCanvas(props: Props) {
  return (
    <div className="relative h-full min-h-0 flex-1">
      <ReactFlowProvider>
        <FlowInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
