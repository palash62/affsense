"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LandingPageBuilder } from "@/modules/page-builder";
import { useBuilderStore } from "@/modules/page-builder/lib/builder-store";
import { createBlankCraftState } from "@/modules/page-builder/lib/serialize";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import { normalizeThemeJson } from "@/modules/page-builder/lib/theme";
import { buildCraftFromOptinTemplate } from "@/lib/optin-funnel-craft-templates";
import { isOptinTemplateId } from "@/lib/optin-templates";
import { cn } from "@/lib/utils";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import { buildFunnelPublicUrl } from "@/lib/platform-host";
import type { FunnelStepId } from "@/components/advertiser/funnel/funnel-types";

function resolveCustomDomainBase(funnel: SerializedOptinFunnel | null | undefined): string | null {
  if (!funnel?.isPublished) return null;
  if (funnel.customDomain?.status !== "VERIFIED") return null;
  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "https://leadvix.io";
  return buildFunnelPublicUrl({
    slug: funnel.slug,
    appUrl,
    customDomain: funnel.customDomain.domain,
  });
}

const DEMO_FONT_STACK = "Montserrat, Inter, Segoe UI, system-ui, sans-serif";

function applyDemoTypography(craft: CraftSerializedState): CraftSerializedState {
  const next = { ...craft };

  const heading = next.heading_main;
  if (heading && typeof heading === "object") {
    const headingProps = (heading.props ?? {}) as Record<string, unknown>;
    const headingTypography = (headingProps.typography ?? {}) as Record<string, string>;
    next.heading_main = {
      ...heading,
      props: {
        ...headingProps,
        typography: {
          ...headingTypography,
          fontFamily: DEMO_FONT_STACK,
          lineHeight: headingTypography.lineHeight ?? "1.15",
          letterSpacing: headingTypography.letterSpacing ?? "-0.02em",
        },
      },
    };
  }

  const paragraph = next.paragraph_main;
  if (paragraph && typeof paragraph === "object") {
    const paragraphProps = (paragraph.props ?? {}) as Record<string, unknown>;
    const paragraphTypography = (paragraphProps.typography ?? {}) as Record<string, string>;
    next.paragraph_main = {
      ...paragraph,
      props: {
        ...paragraphProps,
        typography: {
          ...paragraphTypography,
          fontFamily: DEMO_FONT_STACK,
          lineHeight: paragraphTypography.lineHeight ?? "1.6",
        },
      },
    };
  }

  return next;
}

function resolveOptinCraft(funnel: SerializedOptinFunnel): CraftSerializedState {
  if (funnel.craftState?.craft && Object.keys(funnel.craftState.craft).length > 1) {
    return applyDemoTypography(funnel.craftState.craft);
  }
  if (funnel.templateId && isOptinTemplateId(funnel.templateId)) {
    return applyDemoTypography(buildCraftFromOptinTemplate(funnel.templateId));
  }
  return applyDemoTypography(createBlankCraftState());
}

function resolveThankYouCraft(funnel: SerializedOptinFunnel): CraftSerializedState {
  if (funnel.thankYouCraftState?.craft && Object.keys(funnel.thankYouCraftState.craft).length > 1) {
    return funnel.thankYouCraftState.craft;
  }
  return createBlankCraftState();
}

function parseStepParam(value: string | null): FunnelStepId {
  return value === "thankYou" ? "thankYou" : "optin";
}

export function OptinFunnelBuilderPage({ funnelId }: { funnelId: string }) {
  const searchParams = useSearchParams();
  const stepParam = parseStepParam(searchParams.get("step"));

  const setPageMeta = useBuilderStore((s) => s.setPageMeta);
  const setTheme = useBuilderStore((s) => s.setTheme);
  const setThankYouTheme = useBuilderStore((s) => s.setThankYouTheme);
  const setBuilderConfig = useBuilderStore((s) => s.setBuilderConfig);
  const setCraftSavedListener = useBuilderStore((s) => s.setCraftSavedListener);
  const funnelStep = useBuilderStore((s) => s.funnelStep);
  const setFunnelStep = useBuilderStore((s) => s.setFunnelStep);

  const [funnel, setFunnel] = useState<SerializedOptinFunnel | null>(null);
  const [optinCraft, setOptinCraft] = useState<CraftSerializedState | null>(null);
  const [thankYouCraft, setThankYouCraft] = useState<CraftSerializedState | null>(null);

  useEffect(() => {
    setBuilderConfig({
      apiBasePath: "/api/v1/advertiser/optin-funnels",
      listPath: "/advertiser/optin-funnels",
      detailPath: `/advertiser/optin-funnels/${funnelId}`,
      publicPathPrefix: "/o/",
      label: "Optin Funnel Builder",
      chromeTheme: "light",
      mode: "funnel",
      ui: "ghl",
      thankYouEnabled: funnel?.thankYouEnabled ?? false,
      customDomainId: funnel?.customDomainId ?? null,
      customDomainBase: resolveCustomDomainBase(funnel),
    });
  }, [funnelId, funnel, setBuilderConfig]);

  useEffect(() => {
    setCraftSavedListener((step, craft) => {
      if (step === "optin") {
        setOptinCraft(craft);
        setFunnel((current) =>
          current
            ? {
                ...current,
                craftState: {
                  craft,
                  meta: current.craftState?.meta ?? { schemaVersion: 1, editorBreakPoint: "desktop" },
                },
              }
            : current,
        );
      } else {
        setThankYouCraft(craft);
        setFunnel((current) =>
          current
            ? {
                ...current,
                thankYouCraftState: {
                  craft,
                  meta: current.thankYouCraftState?.meta ?? {
                    schemaVersion: 1,
                    editorBreakPoint: "desktop",
                  },
                },
              }
            : current,
        );
      }
    });

    return () => setCraftSavedListener(null);
  }, [setCraftSavedListener]);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    fetch(`/api/v1/advertiser/optin-funnels/${funnelId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body?.data) {
          throw new Error(body?.error?.message ?? "Failed to load funnel");
        }
        return body.data as SerializedOptinFunnel;
      })
      .then((page) => {
        setFunnel(page);
        setOptinCraft(resolveOptinCraft(page));
        setThankYouCraft(resolveThankYouCraft(page));
        setPageMeta({
          pageId: funnelId,
          pageName: page.name,
          pageSlug: page.slug,
          campaignId: page.campaignId,
        });
        setTheme(normalizeThemeJson(page.themeJson));
        setThankYouTheme(normalizeThemeJson(page.thankYouThemeJson));
        setBuilderConfig({
          apiBasePath: "/api/v1/advertiser/optin-funnels",
          listPath: "/advertiser/optin-funnels",
          detailPath: `/advertiser/optin-funnels/${funnelId}`,
          publicPathPrefix: "/o/",
          label: "Optin Funnel Builder",
          chromeTheme: "light",
          mode: "funnel",
          ui: "ghl",
          thankYouEnabled: page.thankYouEnabled,
          customDomainId: page.customDomainId ?? null,
          customDomainBase: resolveCustomDomainBase(page),
        });
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load funnel");
      });
  }, [funnelId, setPageMeta, setTheme, setThankYouTheme, setBuilderConfig]);

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
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
        <p>{loadError}</p>
        <button
          type="button"
          className="rounded-lg border border-border bg-card px-4 py-2 text-foreground hover:bg-muted"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }

  if (!funnel || !optinCraft || !thankYouCraft) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Loading funnel builder...
      </div>
    );
  }

  const activeCraft = funnelStep === "thankYou" ? thankYouCraft : optinCraft;
  const thankYouDisabled = funnelStep === "thankYou" && !funnel.thankYouEnabled;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {thankYouDisabled && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Enable thank-you redirect in funnel settings to edit this page.
        </div>
      )}

      <div className={cn("min-h-0 flex-1", thankYouDisabled && "pointer-events-none opacity-50")}>
        <LandingPageBuilder
          key={`${funnelId}-${funnelStep}`}
          pageId={funnelId}
          initialCraftState={activeCraft}
          pageName={funnel.name}
          pageSlug={funnel.slug}
          campaignId={funnel.campaignId}
          advertiserId={funnel.advertiserId}
          showCpaOfferSelect
        />
      </div>
    </div>
  );
}
