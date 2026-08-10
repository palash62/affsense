"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  Loader2,
  Palette,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { OptinPageContent } from "@/lib/optin-page";
import { slugifyOptinAddress } from "@/lib/optin-slug";
import { PageSection } from "@/components/admin/page-section";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function OptinPageEditor({
  initialPage,
  publicBaseUrl,
  templateName,
  funnelId,
}: {
  initialPage: OptinPageContent;
  publicBaseUrl: string;
  templateName?: string;
  funnelId?: string;
}) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [bulletText, setBulletText] = useState(initialPage.bulletPoints.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setPage(initialPage);
    setBulletText(initialPage.bulletPoints.join("\n"));
  }, [initialPage]);

  const liveUrl = `${publicBaseUrl}/o/${page.slug}`;
  const previewUrl = `${liveUrl}?preview=1`;
  const publicUrl = page.isPublished ? liveUrl : previewUrl;

  function updateField<K extends keyof OptinPageContent>(key: K, value: OptinPageContent[K]) {
    setPage((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(publish?: boolean) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const bulletPoints = bulletText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6);

    const res = await fetch(
      funnelId ? `/api/v1/advertiser/optin-funnels/${funnelId}` : "/api/v1/advertiser/optin-page",
      {
        method: funnelId ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: page.title.trim(),
          slug: slugifyOptinAddress(page.slug),
          destinationUrl: page.destinationUrl?.trim() || null,
          templateId: page.templateId,
          headline: page.headline,
          subheadline: page.subheadline,
          description: page.description,
          ctaText: page.ctaText,
          successTitle: page.successTitle,
          successMessage: page.successMessage,
          badgeText: page.badgeText,
          bulletPoints,
          primaryColor: page.primaryColor,
          accentColor: page.accentColor,
          isPublished: publish ?? page.isPublished,
          ...(funnelId ? { funnelId } : {}),
        }),
      },
    );
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save optin page");
      return;
    }

    const savedPage = funnelId ? data.data : data.page;
    setPage(savedPage);
    setBulletText(savedPage.bulletPoints.join("\n"));
    setSuccess(publish ? "Optin page published." : "Changes saved.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="rounded-2xl border p-5 lg:col-span-2"
          style={{
            borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
            background: "var(--theme-primary-soft)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Public page link
              </p>
              <p className="mt-1 break-all font-mono text-sm text-foreground">{publicUrl}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {page.isPublished
                  ? "Live — visitors can submit leads on this page."
                  : "Draft — publish when you're ready to go live."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Preview
              </a>
              <Button
                type="button"
                size="sm"
                className="bg-[var(--theme-primary)] hover:opacity-90"
                disabled={saving}
                onClick={() => handleSave(true)}
              >
                {page.isPublished ? (
                  <>
                    <Eye className="mr-1.5 h-4 w-4" />
                    Update live page
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Publish
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
          <button
            type="button"
            onClick={() => updateField("isPublished", !page.isPublished)}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-left transition hover:bg-muted"
          >
            <span className="font-medium text-foreground">
              {page.isPublished ? "Published" : "Draft"}
            </span>
            {page.isPublished ? (
              <ToggleRight className="h-6 w-6 text-emerald-600" />
            ) : (
              <ToggleLeft className="h-6 w-6 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <PageSection
        title="Page Details"
        description={
          templateName
            ? `Editing the ${templateName} template — set your page title and marketing copy.`
            : "Set your page title and marketing copy"
        }
        icon={Sparkles}
        gradient="revenue"
        contentClassName="p-6"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="optin-title">Page title</Label>
            <Input
              id="optin-title"
              value={page.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="My Lead Magnet"
            />
            <p className="text-xs text-muted-foreground">
              Shown on the optin form and browser tab.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="optin-slug">Optin page URL</Label>
            <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/15">
              <span className="flex items-center border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                {publicBaseUrl}/o/
              </span>
              <Input
                id="optin-slug"
                value={page.slug}
                onChange={(e) => updateField("slug", slugifyOptinAddress(e.target.value))}
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="my-company"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Where visitors land before they submit the form.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="optin-destination">Destination address</Label>
            <Input
              id="optin-destination"
              type="url"
              value={page.destinationUrl ?? ""}
              onChange={(e) => updateField("destinationUrl", e.target.value || null)}
              placeholder="https://example.com/thank-you"
            />
            <p className="text-xs text-muted-foreground">
              Visitors are redirected here after they submit the form. Leave empty to show a success
              message on this page instead.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="optin-headline">Headline</Label>
              <Input
                id="optin-headline"
                value={page.headline}
                onChange={(e) => updateField("headline", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="optin-badge">Badge text</Label>
              <Input
                id="optin-badge"
                value={page.badgeText ?? ""}
                onChange={(e) => updateField("badgeText", e.target.value || null)}
                placeholder="Limited spots available"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="optin-subheadline">Subheadline</Label>
            <Input
              id="optin-subheadline"
              value={page.subheadline}
              onChange={(e) => updateField("subheadline", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="optin-description">Description</Label>
            <textarea
              id="optin-description"
              rows={3}
              value={page.description ?? ""}
              onChange={(e) => updateField("description", e.target.value || null)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="optin-bullets">Bullet points (one per line)</Label>
            <textarea
              id="optin-bullets"
              rows={4}
              value={bulletText}
              onChange={(e) => setBulletText(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="optin-cta">Button text</Label>
              <Input
                id="optin-cta"
                value={page.ctaText}
                onChange={(e) => updateField("ctaText", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="optin-success-title">Success title</Label>
              <Input
                id="optin-success-title"
                value={page.successTitle}
                onChange={(e) => updateField("successTitle", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="optin-success-message">Success message</Label>
              <Input
                id="optin-success-message"
                value={page.successMessage}
                onChange={(e) => updateField("successMessage", e.target.value)}
              />
            </div>
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Colors"
        description="Match your brand on the public optin page"
        icon={Palette}
        gradient="revenue"
        contentClassName="p-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="optin-primary">Primary color</Label>
            <div className="flex items-center gap-3">
              <input
                id="optin-primary"
                type="color"
                value={page.primaryColor}
                onChange={(e) => updateField("primaryColor", e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-card"
              />
              <Input
                value={page.primaryColor}
                onChange={(e) => updateField("primaryColor", e.target.value)}
                className="font-mono uppercase"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="optin-accent">Accent color</Label>
            <div className="flex items-center gap-3">
              <input
                id="optin-accent"
                type="color"
                value={page.accentColor}
                onChange={(e) => updateField("accentColor", e.target.value)}
                className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-card"
              />
              <Input
                value={page.accentColor}
                onChange={(e) => updateField("accentColor", e.target.value)}
                className="font-mono uppercase"
              />
            </div>
          </div>
        </div>

        <div
          className={cn("mt-6 rounded-2xl p-6 text-white")}
          style={{
            background: `linear-gradient(135deg, ${page.primaryColor}, ${page.accentColor})`,
          }}
        >
          <p className="text-xs uppercase tracking-wide text-white/70">{page.title}</p>
          <p className="mt-2 text-2xl font-bold">{page.headline}</p>
          <p className="mt-1 text-white/85">{page.subheadline}</p>
          <div className="mt-4 inline-flex rounded-xl bg-card px-4 py-2 text-sm font-semibold text-foreground">
            {page.ctaText}
          </div>
        </div>
      </PageSection>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="h-11 min-w-[160px] bg-[var(--theme-primary)] hover:opacity-90"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
