"use client";

import {
  ArrowLeft,
  CheckCircle2,
  LayoutGrid,
  Loader2,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";
import type { AutomationBuilderState } from "./use-automation-builder-state";

type Props = {
  state: AutomationBuilderState;
  onFitView: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onAutoLayout: () => void;
};

function statusLabel(state: AutomationBuilderState) {
  switch (state.saveStatus) {
    case "dirty":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "blocked":
      return "Can’t autosave — fix issues";
    case "error":
      return state.saveError || "Save failed";
    default:
      return state.automationId ? "Up to date" : "Not saved yet";
  }
}

export function BuilderToolbar({
  state,
  onFitView,
  onZoomIn,
  onZoomOut,
  onAutoLayout,
}: Props) {
  const {
    form,
    steps,
    saveStatus,
    undo,
    redo,
    canUndo,
    canRedo,
    historyTick,
    runValidate,
    persist,
    issues,
  } = state;
  void historyTick;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200/80 bg-white px-3">
      <ButtonLink
        href="/advertiser/email/automations"
        variant="ghost"
        size="sm"
        className="gap-1.5"
      >
        <ArrowLeft className="size-4" />
        Back
      </ButtonLink>

      <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {form.name.trim() || "Untitled automation"}
        </p>
        <p
          className={cn(
            "truncate text-[11px]",
            saveStatus === "error" || saveStatus === "blocked"
              ? "text-amber-700"
              : "text-slate-500",
          )}
        >
          {statusLabel(state)}
        </p>
      </div>

      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canUndo}
          onClick={undo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!canRedo}
          onClick={redo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onZoomOut}
          title="Zoom out"
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onZoomIn} title="Zoom in">
          <ZoomIn className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onFitView}
          title="Fit view"
        >
          <LayoutGrid className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden md:inline-flex"
          onClick={onAutoLayout}
          title="Auto layout"
        >
          Auto layout
        </Button>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const ok = runValidate();
          if (ok) {
            // brief feedback via status
          }
        }}
      >
        <CheckCircle2 className="size-3.5" />
        Validate
        {issues.length > 0 ? (
          <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">
            {issues.length}
          </span>
        ) : null}
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={saveStatus === "saving"}
        onClick={() => void persist(false)}
      >
        {saveStatus === "saving" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Save className="size-3.5" />
        )}
        Save
      </Button>

      <Button
        type="button"
        size="sm"
        disabled={
          saveStatus === "saving" ||
          !form.campaignId.trim() ||
          steps.length < 1 ||
          issues.some((i) => i.path === "campaignId")
        }
        title={
          !form.campaignId.trim()
            ? "Select a list before publishing"
            : steps.length < 1
              ? "Add at least one email step"
              : undefined
        }
        onClick={() => void persist(true)}
      >
        Publish
      </Button>
    </header>
  );
}
