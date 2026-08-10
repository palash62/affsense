"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import { OptinPageEditor } from "@/components/advertiser/optin-page-editor";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LayoutTemplate, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export function OptinFunnelTemplateEditor({
  funnel,
  publicBaseUrl,
  templateName,
}: {
  funnel: SerializedOptinFunnel;
  publicBaseUrl: string;
  templateName?: string;
}) {
  const router = useRouter();
  const [thankYouEnabled, setThankYouEnabled] = useState(funnel.thankYouEnabled);
  const [thankYouPixelHtml, setThankYouPixelHtml] = useState(funnel.thankYouPixelHtml ?? "");
  const [thankYouUseCampaignPixel, setThankYouUseCampaignPixel] = useState(
    funnel.thankYouUseCampaignPixel,
  );
  const [savingThankYou, setSavingThankYou] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState<string | null>(null);

  async function saveThankYouSettings() {
    setSavingThankYou(true);
    setThankYouMessage(null);
    const res = await fetch(`/api/v1/advertiser/optin-funnels/${funnel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thankYouEnabled,
        thankYouPixelHtml,
        thankYouUseCampaignPixel,
      }),
    });
    setSavingThankYou(false);
    if (!res.ok) {
      setThankYouMessage("Unable to save thank-you settings.");
      return;
    }
    setThankYouMessage("Thank-you settings saved.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <OptinPageEditor
        initialPage={funnel}
        publicBaseUrl={publicBaseUrl}
        templateName={templateName}
        funnelId={funnel.id}
      />

      <PageSection
        title="Thank You Page (Optional)"
        description="After submit, redirect visitors to a thank-you page with conversion pixel tracking."
        icon={Sparkles}
        gradient="approved"
        contentClassName="p-6"
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={thankYouEnabled}
              onChange={(e) => setThankYouEnabled(e.target.checked)}
            />
            Enable thank-you page redirect after optin submit
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={thankYouUseCampaignPixel}
              onChange={(e) => setThankYouUseCampaignPixel(e.target.checked)}
            />
            Fire campaign conversion pixel on thank-you page
          </label>

          <div className="space-y-2">
            <Label>Custom pixel / tracking code (HTML)</Label>
            <textarea
              value={thankYouPixelHtml}
              onChange={(e) => setThankYouPixelHtml(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs"
              placeholder="Paste Facebook Pixel, Google tag, or image pixel HTML"
            />
          </div>

          {thankYouEnabled && (
            <ButtonLink
              href={`/advertiser/optin-funnels/${funnel.id}/edit`}
              variant="outline"
              size="sm"
              className="gap-1"
            >
              <LayoutTemplate className="h-4 w-4" />
              Design thank-you page in builder
            </ButtonLink>
          )}

          {thankYouMessage && (
            <p className="text-sm text-muted-foreground">{thankYouMessage}</p>
          )}

          <Button disabled={savingThankYou} onClick={saveThankYouSettings}>
            {savingThankYou ? "Saving..." : "Save thank-you settings"}
          </Button>
        </div>
      </PageSection>
    </div>
  );
}
