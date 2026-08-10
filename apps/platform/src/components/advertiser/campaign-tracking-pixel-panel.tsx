"use client";

import { useState } from "react";
import { Check, Copy, Crosshair } from "lucide-react";
import { buildPixelSnippet, buildPixelUrl, PIXEL_QUERY_PARAMS } from "@/lib/campaign-pixel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CampaignTrackingPixelPanelProps {
  pixelToken: string;
  compact?: boolean;
}

export function CampaignTrackingPixelPanel({
  pixelToken,
  compact = false,
}: CampaignTrackingPixelPanelProps) {
  const [copiedField, setCopiedField] = useState<"url" | "snippet" | null>(null);

  const pixelUrl = buildPixelUrl(pixelToken);

  const pixelSnippet = buildPixelSnippet(pixelUrl);

  async function copyText(value: string, field: "url" | "snippet") {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {!compact && (
        <div
          className="rounded-xl border px-4 py-4"
          style={{
            borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
            background: "var(--theme-primary-soft)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
              <Crosshair className="h-5 w-5 text-[var(--theme-primary)]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Campaign tracking pixel</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Place this pixel on your conversion or thank-you page to track confirmed sales for
                this campaign.
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Pixel ID: <span className="font-mono text-[var(--theme-primary)]">{pixelToken}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pixel URL</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={pixelUrl}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 font-mono text-xs text-foreground"
          />
          <Button
            type="button"
            onClick={() => copyText(pixelUrl, "url")}
            className="h-10 shrink-0 gap-2 rounded-lg bg-[var(--theme-primary)] px-4 hover:opacity-90"
          >
            {copiedField === "url" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedField === "url" ? "Copied!" : "Copy URL"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Image tag</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            readOnly
            rows={compact ? 2 : 3}
            value={pixelSnippet}
            className="min-w-0 flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => copyText(pixelSnippet, "snippet")}
            className="h-10 shrink-0 gap-2 rounded-lg border-border"
          >
            {copiedField === "snippet" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedField === "snippet" ? "Copied!" : "Copy tag"}
          </Button>
        </div>
      </div>

      {!compact && (
        <div className="rounded-lg border border-border bg-muted/80 px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground">Replace placeholders in the URL:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PIXEL_QUERY_PARAMS.map(({ token, description }) => (
              <span
                key={token}
                title={description}
                className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground"
              >
                {token}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
