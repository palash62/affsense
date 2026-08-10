"use client";

import type { OptinTemplateDefinition } from "@/lib/optin-templates";
import { PREVIEW_FALLBACK_FIELDS } from "@/lib/optin-page";
import type { PublicOptinPage } from "@/lib/optin-page";
import { OptinPageLayout } from "@/components/optin/optin-page-layout";
import { Button } from "@/components/ui/button";
import { LayoutTemplate } from "lucide-react";

function templateToPreviewPage(template: OptinTemplateDefinition): PublicOptinPage {
  return {
    id: "preview",
    slug: "preview",
    title: template.name,
    destinationUrl: null,
    campaignId: null,
    templateId: template.id,
    headline: template.headline,
    subheadline: template.subheadline,
    description: "Instant access to proven strategies that turn visitors into customers.",
    ctaText: "Get Instant Access — It's Free",
    successTitle: "You're In! 🎉",
    successMessage: "Check your inbox — your free playbook is on its way.",
    badgeText: template.badgeText,
    bulletPoints: [
      "Proven playbook you can use today",
      "Weekly tips from top marketers",
      "100% free — unsubscribe anytime",
    ],
    primaryColor: template.primaryColor,
    accentColor: template.accentColor,
    isPublished: false,
    campaignName: template.name,
    displayTitle: template.name,
    fields: PREVIEW_FALLBACK_FIELDS,
    previewMode: true,
  };
}

export function OptinFunnelTemplateCard({
  template,
  loading,
  onUse,
}: {
  template: OptinTemplateDefinition;
  loading?: boolean;
  onUse: () => void;
}) {
  const page = templateToPreviewPage(template);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-border hover:shadow-md">
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[720px] w-[960px] origin-top -translate-x-1/2 scale-[0.34]">
          <OptinPageLayout
            page={page}
            thumbnail
            data={{}}
            setData={() => {}}
            honeypot=""
            setHoneypot={() => {}}
            error=""
            status="idle"
            onSubmit={(e) => e.preventDefault()}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="font-semibold text-foreground">{template.name}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
        </div>
        <Button className="w-full" disabled={loading} onClick={onUse}>
          <LayoutTemplate className="mr-1.5 h-4 w-4" />
          Use template
        </Button>
      </div>
    </div>
  );
}
