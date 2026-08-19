"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { BuilderToolbar } from "./builder-toolbar";
import { ActionPickerDialog } from "./action-picker-dialog";
import { InspectorPanel } from "./inspector-panel";
import { AutomationFlowCanvas } from "./automation-flow-canvas";
import {
  useAutomationBuilderState,
  type AutomationBuilderState,
} from "./use-automation-builder-state";
import type { EmailListOption, Trigger } from "./types";

type Props = {
  automationId?: string;
  lists: EmailListOption[];
  initialCreate?: { name: string; trigger: Trigger };
};

function BuilderKeyboardShortcuts({
  state,
  readOnly,
}: {
  state: AutomationBuilderState;
  readOnly: boolean;
}) {
  const { undo, redo, persist, runValidate, selection, removeStep, clearWait } = state;

  useEffect(() => {
    if (readOnly) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (typing) return;
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
        if (typing) return;
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void persist(false);
        return;
      }
      if (mod && e.key.toLowerCase() === "enter") {
        e.preventDefault();
        if (runValidate()) void persist(true);
        return;
      }
      if (!typing && (e.key === "Delete" || e.key === "Backspace")) {
        if (selection.kind === "email") {
          e.preventDefault();
          removeStep(selection.clientId);
        } else if (selection.kind === "wait") {
          e.preventDefault();
          clearWait(selection.clientId);
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, persist, runValidate, selection, removeStep, clearWait, readOnly]);

  return null;
}

export function AutomationBuilderShell({
  automationId,
  lists,
  initialCreate,
}: Props) {
  const searchParams = useSearchParams();
  const readOnly = searchParams.get("view") === "1";

  const state = useAutomationBuilderState({
    automationId,
    lists,
    initialCreate,
    readOnly,
  });

  const flowApiRef = useRef<{
    fitView: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
    autoLayout: () => void;
  } | null>(null);

  if (state.loading) {
    return (
      <div className="flex h-[min(720px,calc(100vh-8rem))] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <p className="text-sm text-slate-500">Loading automation…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[min(780px,calc(100vh-6.5rem))] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <BuilderKeyboardShortcuts state={state} readOnly={readOnly} />
      <BuilderToolbar
        state={state}
        readOnly={readOnly}
        onFitView={() => flowApiRef.current?.fitView()}
        onZoomIn={() => flowApiRef.current?.zoomIn()}
        onZoomOut={() => flowApiRef.current?.zoomOut()}
        onAutoLayout={() => flowApiRef.current?.autoLayout()}
      />
      <div className="flex min-h-0 flex-1">
        <AutomationFlowCanvas state={state} flowApiRef={flowApiRef} />
        <InspectorPanel state={state} />
      </div>

      {!readOnly ? (
        <ActionPickerDialog
          open={state.pickerOpen}
          onOpenChange={state.setPickerOpen}
          atCapacity={state.steps.length >= state.maxSteps}
          canAddWait={
            state.insertIndex < state.steps.length ||
            state.steps.length < state.maxSteps
          }
          onSelectEmail={() => void state.addEmailAt(state.insertIndex)}
          onSelectWait={() => void state.addWaitAt(state.insertIndex)}
        />
      ) : null}

      {state.addingStep ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Creating email…
        </div>
      ) : null}

      {state.saveError && state.saveStatus === "error" ? (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
          {state.saveError}
        </div>
      ) : null}
    </div>
  );
}
