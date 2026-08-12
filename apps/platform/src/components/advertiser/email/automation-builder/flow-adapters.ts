import type { Edge, Node } from "@xyflow/react";
import type {
  AutomationForm,
  AutomationStep,
  Selection,
  TagOption,
  Template,
} from "./types";
import { formatDelay } from "./types";

export const NODE = {
  trigger: "trigger",
  wait: "wait",
  email: "email",
  addAction: "addAction",
} as const;

export const TRIGGER_ID = "trigger";
export const ADD_ACTION_ID = "add-action";

const X = 0;
const Y_GAP = 110;

export type TriggerNodeData = {
  title: string;
  openTagName: string | null;
  clickTagName: string | null;
  selected: boolean;
};

export type WaitNodeData = {
  clientId: string;
  waitLabel: string;
  selected: boolean;
};

export type EmailNodeData = {
  clientId: string;
  order: number;
  templateName: string;
  hasError: boolean;
  selected: boolean;
};

export type AddActionNodeData = {
  label: string;
  disabled: boolean;
};

export function waitNodeId(clientId: string) {
  return `wait-${clientId}`;
}

export function emailNodeId(clientId: string) {
  return `email-${clientId}`;
}

export function stepsToFlow(
  form: AutomationForm,
  steps: AutomationStep[],
  templates: Template[],
  tags: TagOption[],
  selection: Selection,
  maxSteps: number,
  invalidStepIds: Set<string>,
  readOnly = false,
): { nodes: Node[]; edges: Edge[] } {
  const templateMap = new Map(templates.map((t) => [t.id, t.name]));
  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const openTagName = form.openTagId ? (tagMap.get(form.openTagId) ?? "Tag") : null;
  const clickTagName = form.clickTagId ? (tagMap.get(form.clickTagId) ?? "Tag") : null;
  const nodes: Node[] = [
    {
      id: TRIGGER_ID,
      type: NODE.trigger,
      position: { x: X, y: 0 },
      data: {
        title: "Workflow trigger",
        openTagName,
        clickTagName,
        selected: selection.kind === "trigger",
      } satisfies TriggerNodeData,
      draggable: false,
      selectable: true,
    },
  ];

  const edges: Edge[] = [];
  let prevId = TRIGGER_ID;
  let ySlot = 1;

  steps.forEach((step, i) => {
    const wId = waitNodeId(step.clientId);
    const eId = emailNodeId(step.clientId);
    const showWait = step.delayMinutes > 0;

    if (showWait) {
      nodes.push({
        id: wId,
        type: NODE.wait,
        position: { x: X, y: ySlot * Y_GAP },
        data: {
          clientId: step.clientId,
          waitLabel: formatDelay(step.delayMinutes),
          selected: selection.kind === "wait" && selection.clientId === step.clientId,
        } satisfies WaitNodeData,
        draggable: false,
        selectable: true,
      });
      ySlot += 1;

      edges.push({
        id: `e-${prevId}-${wId}`,
        source: prevId,
        target: wId,
        type: "insert",
        data: { insertIndex: i, readOnly },
      });
      prevId = wId;
    }

    nodes.push({
      id: eId,
      type: NODE.email,
      position: { x: X, y: ySlot * Y_GAP },
      data: {
        clientId: step.clientId,
        order: i + 1,
        templateName: step.templateId
          ? (templateMap.get(step.templateId) ?? "Unknown template")
          : "No template",
        hasError: invalidStepIds.has(step.clientId),
        selected: selection.kind === "email" && selection.clientId === step.clientId,
      } satisfies EmailNodeData,
      draggable: false,
      selectable: true,
    });
    ySlot += 1;

    if (showWait) {
      edges.push({
        id: `e-${wId}-${eId}`,
        source: wId,
        target: eId,
        type: "default",
      });
    } else {
      edges.push({
        id: `e-${prevId}-${eId}`,
        source: prevId,
        target: eId,
        type: "insert",
        data: { insertIndex: i, readOnly },
      });
    }

    prevId = eId;
  });

  const canAdd = steps.length < maxSteps;
  nodes.push({
    id: ADD_ACTION_ID,
    type: NODE.addAction,
    position: { x: X, y: ySlot * Y_GAP },
    data: {
      label: steps.length === 0 ? "Add first action" : "Add action",
      disabled: !canAdd || readOnly,
    } satisfies AddActionNodeData,
    draggable: false,
    selectable: false,
  });

  edges.push({
    id: `e-${prevId}-${ADD_ACTION_ID}`,
    source: prevId,
    target: ADD_ACTION_ID,
    type: "default",
  });

  return { nodes, edges };
}
