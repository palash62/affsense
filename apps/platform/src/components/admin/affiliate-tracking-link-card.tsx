"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  AffiliateSearchSelect,
  type SelectedAffiliate,
} from "@/components/admin/affiliate-search-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AffiliateTrackingExtras = { src?: string; subId?: string };

type AffiliateTrackingLinkCardProps = {
  title?: string;
  description?: string;
  buildUrl: (publisherId: string, extras: AffiliateTrackingExtras) => string | null;
  warning?: React.ReactNode;
  /** Rendered between the affiliate picker and the optional parameters. */
  children?: React.ReactNode;
  /** Shown instead of a URL when the offer cannot produce a working link. */
  unavailableMessage?: string;
};

export function AffiliateTrackingLinkCard({
  title = "Affiliate tracking link",
  description = "Pick an affiliate to get the exact tracking link they would use for this offer.",
  buildUrl,
  warning,
  children,
  unavailableMessage,
}: AffiliateTrackingLinkCardProps) {
  const [affiliate, setAffiliate] = useState<SelectedAffiliate | null>(null);
  const [src, setSrc] = useState("");
  const [subId, setSubId] = useState("");

  const trackingUrl = useMemo(() => {
    if (!affiliate || unavailableMessage) return null;
    return buildUrl(affiliate.id, {
      src: src.trim() || undefined,
      subId: subId.trim() || undefined,
    });
  }, [affiliate, unavailableMessage, buildUrl, src, subId]);

  async function copyUrl() {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      toast.success("Tracking link copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-2">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      {warning ? (
        <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--warning)_35%,white)] bg-[color-mix(in_srgb,var(--warning)_10%,white)] px-3 py-2 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
          <div>{warning}</div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-foreground">Affiliate</Label>
        <AffiliateSearchSelect value={affiliate} onChange={setAffiliate} />
      </div>

      {children}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-affiliate-src" className="text-xs font-medium text-foreground">
            Source (src) <span className="font-normal text-muted-foreground">optional</span>
          </Label>
          <Input
            id="admin-affiliate-src"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder="facebook"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-affiliate-sub" className="text-xs font-medium text-foreground">
            Sub ID <span className="font-normal text-muted-foreground">optional</span>
          </Label>
          <Input
            id="admin-affiliate-sub"
            value={subId}
            onChange={(e) => setSubId(e.target.value)}
            placeholder="campaign-a"
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-border pt-4">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Tracking URL
        </p>
        {unavailableMessage ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            {unavailableMessage}
          </p>
        ) : trackingUrl ? (
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 break-all rounded-lg border border-border bg-muted/40 px-3 py-2.5 font-mono text-xs text-foreground">
              {trackingUrl}
            </p>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
              onClick={() => void copyUrl()}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            Select an affiliate to generate their tracking link.
          </p>
        )}
      </div>
    </section>
  );
}
