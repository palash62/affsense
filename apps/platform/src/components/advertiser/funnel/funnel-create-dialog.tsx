"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutTemplate, Pencil } from "lucide-react";
import { FunnelCraftTemplateCard } from "@/components/funnel/funnel-craft-template-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OptinFunnelTemplate } from "@/services/optin-funnel.service";
import { cn } from "@/lib/utils";

type CreateMode = "blank" | "templates";

type FunnelCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  templates: OptinFunnelTemplate[];
  initialMode?: CreateMode;
  initialTemplateId?: string;
  initialName?: string;
  onCreate: (input: { name: string; editorType: "BUILDER"; pageTemplateId?: string }) => void;
};

export function FunnelCreateDialog({
  open,
  onOpenChange,
  loading,
  templates,
  initialMode,
  initialTemplateId,
  initialName,
  onCreate,
}: FunnelCreateDialogProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<CreateMode>("blank");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);
  const fromTemplateLibrary = Boolean(initialTemplateId);
  const quickCreate = fromTemplateLibrary && selectedTemplate && !showTemplatePicker;

  useEffect(() => {
    if (!open) return;
    const nextMode = initialTemplateId ? "templates" : (initialMode ?? "blank");
    setMode(nextMode);
    setName(initialName ?? "");
    setNameTouched(Boolean(initialName));
    setSelectedTemplate(initialTemplateId ?? null);
    setShowTemplatePicker(!initialTemplateId && nextMode === "templates");
  }, [open, initialMode, initialTemplateId, initialName]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => nameInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open, quickCreate]);

  function handleClose(next: boolean) {
    onOpenChange(next);
  }

  function selectTemplate(templateId: string) {
    setSelectedTemplate(templateId);
    setMode("templates");
    if (!nameTouched) {
      const template = templates.find((t) => t.id === templateId);
      if (template) setName(template.name);
    }
    setShowTemplatePicker(false);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;

    if (mode === "blank") {
      onCreate({ name: trimmed, editorType: "BUILDER" });
      return;
    }
    if (mode === "templates" && selectedTemplate) {
      onCreate({
        name: trimmed,
        editorType: "BUILDER",
        pageTemplateId: selectedTemplate,
      });
    }
  }

  const canCreate =
    mode === "blank"
      ? name.trim().length >= 2
      : Boolean(selectedTemplate) && name.trim().length >= 2;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{quickCreate ? "Name your funnel" : "Create new funnel"}</DialogTitle>
          <DialogDescription>
            {quickCreate
              ? "Pick a name for your funnel. You can rename it later in funnel settings."
              : "Choose a starting point and give your funnel a name."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-xl border border-border bg-muted/80 p-4">
          <Label htmlFor="funnel-name" className="text-sm font-medium text-foreground">
            Funnel name
          </Label>
          <Input
            id="funnel-name"
            ref={nameInputRef}
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder="e.g. Summer promo funnel"
            className="h-10 border-border bg-card text-base"
          />
          {mode === "templates" && selectedTemplateData && (
            <p className="text-xs text-muted-foreground">
              Based on template: <span className="font-medium text-foreground">{selectedTemplateData.name}</span>
            </p>
          )}
        </div>

        {quickCreate ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <FunnelCraftTemplateCard
              id={selectedTemplateData!.id}
              name={selectedTemplateData!.name}
              craftState={selectedTemplateData!.craftState}
              themeJson={selectedTemplateData!.themeJson}
              thankYouEnabled={selectedTemplateData!.thankYouEnabled}
              variant="picker"
              selected
            />
            <div className="border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={() => setShowTemplatePicker(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Choose a different template
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("blank");
                  setSelectedTemplate(null);
                  setShowTemplatePicker(false);
                }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  mode === "blank"
                    ? "border-blue-600 bg-blue-50/50"
                    : "border-border hover:border-border",
                )}
              >
                <div className="mb-3 flex h-16 items-center justify-center rounded-lg border border-dashed border-border bg-white">
                  <LayoutTemplate className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">Start from blank</p>
                <p className="mt-1 text-xs text-muted-foreground">Build your opt-in page from scratch.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode("templates");
                  setShowTemplatePicker(true);
                }}
                className={cn(
                  "rounded-xl border-2 p-4 text-left transition",
                  mode === "templates"
                    ? "border-blue-600 bg-blue-50/50"
                    : "border-border hover:border-border",
                )}
              >
                <div className="mb-3 flex h-16 items-center justify-center gap-1 rounded-lg bg-muted">
                  <div className="h-12 w-8 rounded bg-blue-200" />
                  <div className="h-12 w-8 rounded bg-teal-200" />
                  <div className="h-12 w-8 rounded bg-violet-200" />
                </div>
                <p className="font-semibold text-foreground">Use a template</p>
                <p className="mt-1 text-xs text-muted-foreground">Start from a prebuilt layout and customize it.</p>
              </button>
            </div>

            {mode === "templates" && showTemplatePicker && (
              <div className="grid max-h-[360px] gap-4 overflow-y-auto sm:grid-cols-2">
                {templates.length === 0 && (
                  <div className="col-span-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No templates available yet. Ask admin to create templates.
                  </div>
                )}
                {templates.map((template) => (
                  <FunnelCraftTemplateCard
                    key={template.id}
                    id={template.id}
                    name={template.name}
                    craftState={template.craftState}
                    themeJson={template.themeJson}
                    thankYouEnabled={template.thankYouEnabled}
                    selected={selectedTemplate === template.id}
                    loading={loading}
                    variant="picker"
                    onSelect={() => selectTemplate(template.id)}
                  />
                ))}
              </div>
            )}

            {mode === "templates" && selectedTemplate && !showTemplatePicker && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2">
                <p className="text-sm text-foreground">
                  Template: <span className="font-medium">{selectedTemplateData?.name}</span>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowTemplatePicker(true)}
                >
                  Change
                </Button>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button disabled={!canCreate || loading} onClick={handleCreate}>
            {loading ? "Creating..." : "Create funnel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
