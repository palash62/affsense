"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Palette, Save } from "lucide-react";
import type { OptinPageContent } from "@/lib/optin-page";
import { listOptinTemplates, type OptinTemplateId } from "@/lib/optin-templates";
import { PageSection } from "@/components/admin/page-section";
import { OptinTemplateThumbnail } from "@/components/optin/optin-template-thumbnail";
import { LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OptinTemplateGallery({
  currentPage,
}: {
  currentPage: OptinPageContent | null;
}) {
  const router = useRouter();
  const templates = listOptinTemplates();
  const [livePage, setLivePage] = useState<OptinPageContent | null>(currentPage);
  const [selectedId, setSelectedId] = useState<OptinTemplateId | null>(
    currentPage?.templateId ?? null,
  );
  const [primaryColor, setPrimaryColor] = useState(currentPage?.primaryColor ?? "#6366f1");
  const [accentColor, setAccentColor] = useState(currentPage?.accentColor ?? "#a855f7");
  const [loadingId, setLoadingId] = useState<OptinTemplateId | null>(null);
  const [savingColors, setSavingColors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refreshPage = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/advertiser/optin-page", { cache: "no-store" });
      const data = await res.json();
      if (data.page) {
        setLivePage(data.page);
      }
    } catch {
      // Keep existing page data if refresh fails.
    }
  }, []);

  useEffect(() => {
    setLivePage(currentPage);
    if (currentPage) {
      setSelectedId(currentPage.templateId);
      setPrimaryColor(currentPage.primaryColor);
      setAccentColor(currentPage.accentColor);
    }
  }, [currentPage]);

  useEffect(() => {
    void refreshPage();
    const onFocus = () => void refreshPage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPage]);

  const previewColors = { primaryColor, accentColor };

  async function chooseTemplate(templateId: OptinTemplateId) {
    if (loadingId) return;

    const previous = { selectedId, primaryColor, accentColor };
    setSelectedId(templateId);
    setLoadingId(templateId);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/v1/advertiser/optin-page/select-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json().catch(() => ({}));

    setLoadingId(null);

    if (!res.ok) {
      setSelectedId(previous.selectedId);
      setPrimaryColor(previous.primaryColor);
      setAccentColor(previous.accentColor);
      setError(data?.error?.message ?? "Unable to select template. Refresh the page and try again.");
      return;
    }

    setSelectedId(templateId);
    setPrimaryColor(data.page.primaryColor);
    setAccentColor(data.page.accentColor);
    setLivePage(data.page);
    setSuccess(`${templates.find((t) => t.id === templateId)?.name ?? "Template"} selected. Hover and click Edit.`);
    router.refresh();
  }

  async function saveColors() {
    setSavingColors(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/v1/advertiser/optin-page/colors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryColor, accentColor }),
    });
    const data = await res.json();

    setSavingColors(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save colors");
      return;
    }

    setLivePage(data.page);
    setSuccess("Colors saved.");
    router.refresh();
  }

  function openEditor() {
    router.push("/advertiser/optin-pages/edit");
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <PageSection
        title="Choose a Template"
        description="Click a template to select it. Hover the selected page and click Edit to customize."
        icon={LayoutTemplate}
        gradient="revenue"
        contentClassName="p-6"
      >
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <div key={template.id} className="relative">
              {loadingId === template.id && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-card/80">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--theme-primary)]" />
                </div>
              )}
              <OptinTemplateThumbnail
                template={template}
                selected={selectedId === template.id}
                selecting={loadingId === template.id}
                colors={selectedId === template.id ? previewColors : undefined}
                pageContent={livePage}
                onSelect={() => chooseTemplate(template.id)}
                onEdit={openEditor}
              />
            </div>
          ))}
        </div>
      </PageSection>

      {selectedId && (
        <PageSection
          title="Brand Colors"
          description="Adjust colors for your selected template. Thumbnails update live."
          icon={Palette}
          gradient="revenue"
          contentClassName="p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gallery-primary">Primary color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="gallery-primary"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-card"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gallery-accent">Accent color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="gallery-accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-card"
                />
                <Input
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="font-mono uppercase"
                />
              </div>
            </div>
          </div>

          <div
            className="mt-5 rounded-2xl p-5 text-white"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
          >
            <p className="text-xs uppercase tracking-wide text-white/70">Color preview</p>
            <p className="mt-2 text-lg font-bold">{livePage?.title ?? "Your optin page"}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={saveColors}
              disabled={savingColors}
              className="gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
            >
              {savingColors ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save colors
            </Button>
            <Button type="button" variant="outline" onClick={openEditor}>
              Edit page content
            </Button>
          </div>
        </PageSection>
      )}
    </div>
  );
}
