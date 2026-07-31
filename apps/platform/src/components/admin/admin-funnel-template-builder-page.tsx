"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LandingPageBuilder } from "@/modules/page-builder";
import { useBuilderStore } from "@/modules/page-builder/lib/builder-store";
import { createBlankCraftState, ensureEditorCraftState } from "@/modules/page-builder/lib/serialize";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import { normalizeThemeJson } from "@/modules/page-builder/lib/theme";
import { cn } from "@/lib/utils";
import type { FunnelStepId } from "@/components/advertiser/funnel/funnel-types";

type AdminTemplate = {
  id: string;
  slug: string;
  name: string;
  craftState: CraftSerializedState;
  themeJson: ThemeJson;
  thankYouEnabled: boolean;
  destinationUrl: string | null;
  thankYouPixelHtml: string | null;
  thankYouUseCampaignPixel: boolean;
  thankYouCraftState: CraftSerializedState | null;
  thankYouThemeJson: ThemeJson | null;
  isPublished: boolean;
};

function parseStepParam(value: string | null): FunnelStepId {
  return value === "thankYou" ? "thankYou" : "optin";
}

export function AdminFunnelTemplateBuilderPage({ templateId }: { templateId: string }) {
  const searchParams = useSearchParams();
  const stepParam = parseStepParam(searchParams.get("step"));

  const setPageMeta = useBuilderStore((s) => s.setPageMeta);
  const setTheme = useBuilderStore((s) => s.setTheme);
  const setThankYouTheme = useBuilderStore((s) => s.setThankYouTheme);
  const setBuilderConfig = useBuilderStore((s) => s.setBuilderConfig);
  const setCraftSavedListener = useBuilderStore((s) => s.setCraftSavedListener);
  const funnelStep = useBuilderStore((s) => s.funnelStep);
  const setFunnelStep = useBuilderStore((s) => s.setFunnelStep);

  const [template, setTemplate] = useState<AdminTemplate | null>(null);
  const [optinCraft, setOptinCraft] = useState<CraftSerializedState | null>(null);
  const [thankYouCraft, setThankYouCraft] = useState<CraftSerializedState | null>(null);

  useEffect(() => {
    setBuilderConfig({
      apiBasePath: "/api/v1/admin/optin-funnel-templates",
      listPath: "/admin/funnel-templates",
      detailPath: `/admin/funnel-templates/${templateId}`,
      publicPathPrefix: "/o/",
      label: "Optin Funnel Builder",
      chromeTheme: "light",
      mode: "funnel",
      ui: "ghl",
      thankYouEnabled: template?.thankYouEnabled ?? false,
      templateIsPublished: template?.isPublished ?? false,
    });
  }, [setBuilderConfig, templateId, template?.thankYouEnabled, template?.isPublished]);

  useEffect(() => {
    setCraftSavedListener((step, savedCraft) => {
      if (step === "thankYou") {
        setThankYouCraft(savedCraft);
        setTemplate((current) => (current ? { ...current, thankYouCraftState: savedCraft } : current));
        return;
      }
      setOptinCraft(savedCraft);
      setTemplate((current) => (current ? { ...current, craftState: savedCraft } : current));
    });
    return () => setCraftSavedListener(null);
  }, [setCraftSavedListener]);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    fetch(`/api/v1/admin/optin-funnel-templates/${templateId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Failed to load funnel template");
        }
        return body.data as AdminTemplate;
      })
      .then((page) => {
        setTemplate(page);
        setOptinCraft(ensureEditorCraftState(page.craftState ?? createBlankCraftState()));
        setThankYouCraft(ensureEditorCraftState(page.thankYouCraftState ?? createBlankCraftState()));
        setPageMeta({
          pageId: templateId,
          pageName: page.name,
          pageSlug: page.slug,
          campaignId: null,
        });
        setTheme(normalizeThemeJson(page.themeJson));
        setThankYouTheme(normalizeThemeJson(page.thankYouThemeJson ?? page.themeJson));
        setBuilderConfig({
          apiBasePath: "/api/v1/admin/optin-funnel-templates",
          listPath: "/admin/funnel-templates",
          detailPath: `/admin/funnel-templates/${templateId}`,
          publicPathPrefix: "/o/",
          label: "Optin Funnel Builder",
          chromeTheme: "light",
          mode: "funnel",
          ui: "ghl",
          thankYouEnabled: page.thankYouEnabled,
          templateIsPublished: page.isPublished,
        });
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load funnel template");
      });
  }, [templateId, setPageMeta, setTheme, setThankYouTheme, setBuilderConfig]);

  const switchStep = useCallback(
    async (step: FunnelStepId) => {
      if (step === funnelStep) return;
      await useBuilderStore.getState().flushSave?.();
      setFunnelStep(step);
    },
    [funnelStep, setFunnelStep],
  );

  useEffect(() => {
    if (funnelStep !== stepParam) {
      void switchStep(stepParam);
    }
  }, [stepParam, funnelStep, switchStep]);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-600">
        <p>{loadError}</p>
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-slate-700 hover:bg-slate-50"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }

  if (!template || !optinCraft || !thankYouCraft) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading funnel builder...
      </div>
    );
  }

  const activeCraft = funnelStep === "thankYou" ? thankYouCraft : optinCraft;
  const thankYouDisabled = funnelStep === "thankYou" && !template.thankYouEnabled;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {thankYouDisabled && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Enable thank-you redirect in funnel settings to edit this page.
        </div>
      )}

      <div className={cn("min-h-0 flex-1", thankYouDisabled && "pointer-events-none opacity-50")}>
        <LandingPageBuilder
          key={`${templateId}-${funnelStep}`}
          pageId={templateId}
          initialCraftState={activeCraft}
          pageName={template.name}
          pageSlug={template.slug}
          campaignId={null}
        />
      </div>
    </div>
  );
}
