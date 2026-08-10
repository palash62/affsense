"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LandingPageBuilder } from "@/modules/page-builder";
import { useBuilderStore } from "@/modules/page-builder/lib/builder-store";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import { normalizeThemeJson } from "@/modules/page-builder/lib/theme";

export default function LandingPageEditPage() {
  const params = useParams();
  const pageId = params.id as string;
  const setPageMeta = useBuilderStore((s) => s.setPageMeta);
  const setTheme = useBuilderStore((s) => s.setTheme);

  const [state, setState] = useState<{
    craftState: CraftSerializedState;
    name: string;
    slug: string;
    campaignId: string | null;
  } | null>(null);

  useEffect(() => {
    useBuilderStore.getState().setBuilderConfig({
      apiBasePath: "/api/v1/advertiser/landing-pages",
      listPath: "/advertiser/landing-pages",
      publicPathPrefix: "/p/",
      label: "Landing Page Builder",
      chromeTheme: "light",
      mode: "page",
      ui: "ghl",
    });
    useBuilderStore.getState().setFunnelStep("optin");
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    fetch(`/api/v1/advertiser/landing-pages/${pageId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body?.data?.craftState?.craft) {
          throw new Error(body?.error?.message ?? "Failed to load landing page");
        }
        return body.data;
      })
      .then((page) => {
        setState({
          craftState: page.craftState.craft,
          name: page.name,
          slug: page.slug,
          campaignId: page.campaignId,
        });
        setPageMeta({ pageId, pageName: page.name, pageSlug: page.slug, campaignId: page.campaignId });
        setTheme(normalizeThemeJson(page.themeJson));
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load landing page");
      });
  }, [pageId, setPageMeta, setTheme]);

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

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        Loading builder...
      </div>
    );
  }

  return (
    <LandingPageBuilder
      pageId={pageId}
      initialCraftState={state.craftState}
      pageName={state.name}
      pageSlug={state.slug}
      campaignId={state.campaignId}
    />
  );
}
