"use client";

import { useEffect, useState } from "react";
import { LayoutTemplate } from "lucide-react";
import { FunnelCraftTemplateCard } from "@/components/funnel/funnel-craft-template-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import { cn } from "@/lib/utils";

type CreateMode = "blank" | "templates";

type AdminTemplate = {
  id: string;
  name: string;
  craftState: CraftSerializedState;
  themeJson: ThemeJson;
  thankYouEnabled?: boolean;
};

type AdminFunnelTemplateCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onCreate: (input: { name: string; sourceTemplateId?: string }) => void;
};

export function AdminFunnelTemplateCreateDialog({
  open,
  onOpenChange,
  loading,
  onCreate,
}: AdminFunnelTemplateCreateDialogProps) {
  const [mode, setMode] = useState<CreateMode>("blank");
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/v1/admin/optin-funnel-templates")
      .then((r) => r.json())
      .then((body) => setTemplates(body.data ?? []))
      .catch(() => setTemplates([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMode("blank");
    setName("");
    setSelectedTemplate(null);
  }, [open]);

  function handleClose(next: boolean) {
    onOpenChange(next);
  }

  function handleCreate() {
    if (mode === "blank") {
      const trimmed = name.trim();
      if (trimmed.length < 2) return;
      onCreate({ name: trimmed });
      return;
    }
    if (mode === "templates" && selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate);
      const cloneName = `${template?.name ?? "Template"} Copy`.trim().slice(0, 80);
      onCreate({
        name: cloneName,
        sourceTemplateId: selectedTemplate,
      });
    }
  }

  const canCreate =
    mode === "blank" ? name.trim().length >= 2 : Boolean(selectedTemplate);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create new funnel template</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("blank")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition",
              mode === "blank" ? "border-blue-600 bg-blue-50/50" : "border-border hover:border-border",
            )}
          >
            <div className="mb-3 rounded-lg border border-dashed border-border bg-muted p-3">
              <Label className="text-xs text-muted-foreground">Template name *</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setMode("blank");
                  setName(e.target.value);
                }}
                placeholder="e.g. Lead Capture Template"
                className="mt-1 h-9 border-border bg-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p className="font-semibold text-foreground">From blank</p>
            <p className="mt-1 text-xs text-muted-foreground">Design from scratch using the funnel builder.</p>
          </button>

          <button
            type="button"
            onClick={() => setMode("templates")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition",
              mode === "templates" ? "border-blue-600 bg-blue-50/50" : "border-border hover:border-border",
            )}
          >
            <div className="mb-3 flex h-24 items-center justify-center gap-1 rounded-lg bg-muted">
              <div className="h-14 w-10 rounded bg-blue-200" />
              <div className="h-14 w-10 rounded bg-teal-200" />
              <div className="h-14 w-10 rounded bg-violet-200" />
            </div>
            <p className="font-semibold text-foreground">From templates</p>
            <p className="mt-1 text-xs text-muted-foreground">Jump start with an awesome prebuilt funnel.</p>
          </button>
        </div>

        {mode === "templates" && (
          <div className="grid max-h-[420px] gap-4 overflow-y-auto sm:grid-cols-2">
            {templates.length === 0 && (
              <div className="col-span-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No templates available yet. Create a blank template first.
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
                onSelect={() => setSelectedTemplate(template.id)}
              />
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button disabled={!canCreate || loading} onClick={handleCreate}>
            <LayoutTemplate className="mr-2 h-4 w-4" />
            Create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
