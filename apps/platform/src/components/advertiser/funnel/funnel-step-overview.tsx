"use client";

import { useState } from "react";
import {
  ExternalLink,
  Eye,
  Globe,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";
import type { OptinFunnelEditorType } from "@prisma/client";
import { usesBuilderRenderer } from "@/lib/optin-funnel";
import { OptinFunnelCraftThumbnail } from "@/components/advertiser/optin-funnel-craft-thumbnail";
import { funnelCraftPreviewRevision } from "@/components/optin/funnel-craft-preview-frame";
import { DEFAULT_THEME } from "@/modules/page-builder/lib/theme";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  resolvePreviewUrl,
  type FunnelStepId,
  type FunnelWorkflowConfig,
  type FunnelWorkflowEntity,
} from "./funnel-types";

type FunnelStepOverviewProps = {
  entity: FunnelWorkflowEntity;
  workflow: FunnelWorkflowConfig;
  stepId: FunnelStepId;
  appUrl: string;
  onSettingsClick: () => void;
  onConnectDomainClick?: () => void;
  onEntityUpdated?: (data: unknown) => void;
  onStepDeleted?: () => void;
};

function resolveThumbnail(entity: FunnelWorkflowEntity, stepId: FunnelStepId) {
  const craftState = stepId === "thankYou" ? entity.thankYouCraftState : entity.craftState;
  const themeJson = stepId === "thankYou" ? entity.thankYouThemeJson : entity.themeJson;
  return { craftState, themeJson: themeJson ?? DEFAULT_THEME };
}

function craftNodeName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  return (node as { type?: { resolvedName?: string } }).type?.resolvedName ?? null;
}

function isBlankOrStructuralCraft(craftState: FunnelWorkflowEntity["thankYouCraftState"]): boolean {
  const craft = craftState?.craft;
  if (!craft || Object.keys(craft).length <= 1) return true;

  const structural = new Set(["CanvasRoot", "Section", "Container", "Row", "Column"]);
  return !Object.values(craft).some((node) => {
    const name = craftNodeName(node);
    return !!name && !structural.has(name);
  });
}

function looksLikeOptinSkeleton(craftState: FunnelWorkflowEntity["thankYouCraftState"]): boolean {
  const craft = craftState?.craft;
  if (!craft) return false;
  return Object.values(craft).some((node) => craftNodeName(node) === "LeadForm");
}

function hasThankYouDesign(entity: FunnelWorkflowEntity): boolean {
  if (isBlankOrStructuralCraft(entity.thankYouCraftState)) return false;
  if (looksLikeOptinSkeleton(entity.thankYouCraftState)) return false;
  return true;
}

function hasOptinDesign(entity: FunnelWorkflowEntity): boolean {
  if (entity.editorType) {
    return usesBuilderRenderer({
      editorType: entity.editorType as OptinFunnelEditorType,
      craftState: entity.craftState,
    });
  }
  return !isBlankOrStructuralCraft(entity.craftState);
}

export function FunnelStepOverview({
  entity,
  workflow,
  stepId,
  appUrl,
  onSettingsClick,
  onConnectDomainClick,
  onEntityUpdated,
  onStepDeleted,
}: FunnelStepOverviewProps) {
  const [deleting, setDeleting] = useState(false);
  const stepName = stepId === "thankYou" ? "thank you" : "optin page";
  const { previewHref, previewUrl } = resolvePreviewUrl(entity, workflow, stepId, appUrl);
  const editHref = workflow.editPath(entity.id, stepId);
  const { craftState, themeJson } = resolveThumbnail(entity, stepId);
  const thumbnailRevision = funnelCraftPreviewRevision(craftState?.craft, themeJson);

  const showCraft = stepId === "thankYou" ? hasThankYouDesign(entity) : hasOptinDesign(entity);
  const isBlankThankYou = stepId === "thankYou" && !hasThankYouDesign(entity);

  async function patchEntity(body: Record<string, unknown>) {
    const res = await fetch(`${workflow.apiBasePath}/${entity.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message ?? "Unable to update funnel");
    }
    return data.data;
  }

  async function handleDeleteStep() {
    if (stepId !== "thankYou") return;
    if (!window.confirm("Delete the thank you step? This removes its page design.")) return;

    setDeleting(true);
    try {
      const saved = await patchEntity({
        thankYouEnabled: false,
        thankYouCraftState: null,
      });
      onEntityUpdated?.(saved);
      onStepDeleted?.();
      toast.success("Thank you step deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to delete step");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-lg font-semibold capitalize text-foreground">{stepName}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={editHref} size="default" className="h-8 gap-1.5 px-3">
            <Pencil className="h-4 w-4" />
            Edit template
          </ButtonLink>
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview
          </a>
          <Button variant="outline" size="sm" className="h-8" onClick={onSettingsClick}>
            <Settings className="mr-1.5 h-4 w-4" />
            Funnel settings
          </Button>
          {onConnectDomainClick && (
            <Button variant="outline" size="sm" className="h-8" onClick={onConnectDomainClick}>
              <Globe className="mr-1.5 h-4 w-4" />
              Connect domain
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6 p-5">
        {workflow.showPublishHint && !entity.isPublished && (
          <p className="text-sm text-amber-700">
            Please publish your funnel to see it live. Visitors can preview drafts from the editor.
          </p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Settings className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input readOnly value={previewUrl} className="h-10 border-border bg-muted pl-9 pr-10 font-mono text-xs" />
          </div>
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "h-10 w-10 shrink-0")}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Control</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="bg-muted p-4">
              <div className="relative mx-auto aspect-[16/10] w-full max-w-md overflow-hidden rounded-lg border border-border bg-muted shadow-sm">
                {showCraft && !isBlankThankYou ? (
                  <OptinFunnelCraftThumbnail
                    key={`${stepId}-${thumbnailRevision}`}
                    craftState={craftState}
                    themeJson={themeJson}
                    scale={0.28}
                    emptyFallback="blank"
                  />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-sm text-muted-foreground">No page design yet</p>
                    <ButtonLink href={editHref} size="sm">
                      Create from blank
                    </ButtonLink>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-4">
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={stepId === "optin" || deleting}
          onClick={() => void handleDeleteStep()}
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          {deleting ? "Deleting..." : "Delete funnel step"}
        </Button>
      </div>
    </div>
  );
}
