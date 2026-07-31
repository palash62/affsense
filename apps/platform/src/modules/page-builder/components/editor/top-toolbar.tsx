"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useEditor } from "@craftjs/core";
import {
  Undo2, Redo2, Save, Eye, Upload, History, ArrowLeft, Loader2, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeviceSwitcher } from "@/modules/page-builder/components/editor/device-switcher";
import { FunnelStepsPopover } from "@/components/advertiser/funnel/funnel-steps-popover";
import { buildFunnelSteps } from "@/components/advertiser/funnel/funnel-types";
import { useBuilderStore } from "@/modules/page-builder/lib/builder-store";
import { getBuilderChrome } from "@/modules/page-builder/lib/builder-chrome";
import { isAdminTemplateBuilder, isGhlBuilderMode } from "@/modules/page-builder/lib/builder-mode";
import { savePageCraft } from "@/modules/page-builder/lib/save-page";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TopToolbarProps = { pageId: string; pageName: string; pageSlug: string };

export function TopToolbar({ pageId, pageName, pageSlug }: TopToolbarProps) {
  const router = useRouter();
  const [publishDomainDialogOpen, setPublishDomainDialogOpen] = useState(false);
  const { actions, query, canUndo, canRedo } = useEditor((state, query) => ({
    canUndo: query.history.canUndo(),
    canRedo: query.history.canRedo(),
  }));

  const saveStatus = useBuilderStore((s) => s.saveStatus);
  const setPreviewOpen = useBuilderStore((s) => s.setPreviewOpen);
  const setVersionHistoryOpen = useBuilderStore((s) => s.setVersionHistoryOpen);
  const builderConfig = useBuilderStore((s) => s.builderConfig);
  const funnelStep = useBuilderStore((s) => s.funnelStep);
  const chrome = getBuilderChrome(builderConfig.chromeTheme ?? "dark");

  const backHref =
    builderConfig.mode === "funnel" && builderConfig.detailPath
      ? builderConfig.detailPath
      : builderConfig.listPath;

  const stepLabel = funnelStep === "thankYou" ? "thank you" : "optin page";
  const isFunnel = builderConfig.mode === "funnel";
  const isAdminTemplate = isAdminTemplateBuilder(builderConfig);
  const isGhl = isGhlBuilderMode(builderConfig);

  async function handleSave() {
    const json = query.serialize();
    const result = await savePageCraft(pageId, json, { autosave: false });
    if (!result.ok) {
      toast.error(result.errorMessage ?? "Failed to save page");
      return false;
    }
    toast.success("Page saved");
    return true;
  }

  async function publishFunnel() {
    try {
      const res = await fetch(`${builderConfig.apiBasePath}/${pageId}/publish`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? "Publish failed");
      }
      toast.success("Page published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    }
  }

  async function toggleAdminTemplatePublish() {
    const next = !builderConfig.templateIsPublished;
    const ok = await handleSave();
    if (!ok) return;
    try {
      const res = await fetch(`${builderConfig.apiBasePath}/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.message ?? "Failed to update publish status");
      }
      useBuilderStore.getState().setBuilderConfig({
        ...builderConfig,
        templateIsPublished: next,
      });
      toast.success(next ? "Template published" : "Template set to draft");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update publish status");
    }
  }

  async function handlePublish() {
    const ok = await handleSave();
    if (!ok) return;

    if (isFunnel && !builderConfig.customDomainId) {
      setPublishDomainDialogOpen(true);
      return;
    }

    await publishFunnel();
  }

  function handleConnectDomain() {
    setPublishDomainDialogOpen(false);
    window.open("/advertiser/domains", "_blank", "noopener,noreferrer");
  }

  async function handlePublishWithDefaultDomain() {
    setPublishDomainDialogOpen(false);
    await publishFunnel();
  }

  async function handleBack() {
    await useBuilderStore.getState().flushSave?.();
    router.push(backHref);
  }

  async function handlePreview() {
    const saved = await useBuilderStore.getState().flushSave?.();
    if (saved === false) {
      toast.error("Save failed — fix errors before previewing");
      return;
    }

    const breakpoint = useBuilderStore.getState().breakpoint;
    const cacheBust = `t=${Date.now()}`;
    const frameQuery = "frame=1&";
    const bpQuery = `bp=${breakpoint}&`;

    if (isAdminTemplate) {
      const stepQuery = funnelStep === "thankYou" ? "step=thankYou&" : "";
      window.open(
        `/admin/funnel-templates/${pageId}/preview?${stepQuery}${frameQuery}${bpQuery}${cacheBust}`,
        "_blank",
        "noopener,noreferrer",
      );
      return;
    }
    if (isFunnel) {
      const thankYouSuffix = funnelStep === "thankYou" ? "/thank-you" : "";
      const previewQuery = `?preview=1&${frameQuery}${bpQuery}${cacheBust}`;
      const previewPath = builderConfig.customDomainBase
        ? `${builderConfig.customDomainBase}${thankYouSuffix || "/"}${previewQuery}`
        : `${builderConfig.publicPathPrefix}${pageSlug}${thankYouSuffix}${previewQuery}`;
      window.open(previewPath, "_blank", "noopener,noreferrer");
      return;
    }
    setPreviewOpen(true);
  }

  return (
    <header className={cn("flex h-12 shrink-0 items-center gap-2 px-3", chrome.toolbar)}>
      <button
        type="button"
        onClick={handleBack}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          chrome.toolbarLink,
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back</span>
      </button>

      <div className={cn("mx-1.5 h-5 w-px", chrome.toolbarDivider)} />

      {isFunnel ? (
        <FunnelStepsPopover
          funnelId={pageId}
          steps={buildFunnelSteps(builderConfig.thankYouEnabled ?? false)}
          currentStepId={funnelStep}
          currentStepLabel={stepLabel}
        />
      ) : (
        <div className="min-w-0">
          <p className={cn("truncate text-sm font-semibold", chrome.toolbarTitle)}>{pageName}</p>
          <p className={cn("text-[10px]", chrome.toolbarSubtitle)}>
            {isAdminTemplate ? "Funnel template" : builderConfig.label}
          </p>
        </div>
      )}

      <div className={cn("mx-1.5 h-5 w-px", chrome.toolbarDivider)} />

      {!isGhl && (
        <>
          <div className="hidden items-center gap-0.5 md:flex">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo}
              onClick={() => actions.history.undo()}
              className={cn("h-8 w-8", chrome.toolbarGhost)}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRedo}
              onClick={() => actions.history.redo()}
              className={cn("h-8 w-8", chrome.toolbarGhost)}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>

          <div className={cn("mx-2 hidden h-6 w-px md:block", chrome.toolbarDivider)} />
        </>
      )}

      <DeviceSwitcher />

      <div className="flex-1" />

      <div className={cn("flex items-center gap-1.5 text-xs", chrome.toolbarSubtitle)}>
        {saveStatus === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving...
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-emerald-600">Saved</span>
          </>
        )}
        {saveStatus === "idle" && "Autosave on"}
        {saveStatus === "error" && <span className="text-red-500">Save failed</span>}
      </div>

      <div className={cn("mx-1.5 h-5 w-px", chrome.toolbarDivider)} />

      <Button variant="ghost" size="sm" onClick={() => void handlePreview()} className={chrome.toolbarGhost}>
        <Eye className="mr-1.5 h-4 w-4" />
        Preview
      </Button>
      {!isAdminTemplate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setVersionHistoryOpen(true)}
          className={cn("hidden sm:flex", chrome.toolbarGhost, isGhl && "!hidden")}
        >
          <History className="mr-1.5 h-4 w-4" />
          Versions
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={handleSave} className={chrome.toolbarOutline}>
        <Save className="mr-1.5 h-4 w-4" />
        Save
      </Button>
      {isAdminTemplate ? (
        <>
          <span
            className={cn(
              "hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline",
              builderConfig.templateIsPublished
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            )}
          >
            {builderConfig.templateIsPublished ? "Published" : "Draft"}
          </span>
          <Button
            size="sm"
            variant={builderConfig.templateIsPublished ? "outline" : "default"}
            onClick={() => void toggleAdminTemplatePublish()}
            className={
              builderConfig.templateIsPublished ? chrome.toolbarOutline : chrome.toolbarPublish
            }
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {builderConfig.templateIsPublished ? "Unpublish" : "Publish"}
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => void handlePublish()} className={chrome.toolbarPublish}>
          <Upload className="mr-1.5 h-4 w-4" />
          Publish
        </Button>
      )}

      <Dialog open={publishDomainDialogOpen} onOpenChange={setPublishDomainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish without a custom domain?</DialogTitle>
            <DialogDescription>
              This funnel is not connected to a custom domain. You can connect one now or publish on
              the default platform URL at <span className="font-mono">/o/{pageSlug}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleConnectDomain}>
              Connect domain
            </Button>
            <Button onClick={() => void handlePublishWithDefaultDomain()}>
              Publish with default domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
