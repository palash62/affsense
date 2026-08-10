"use client";

import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { CampaignTrackingPixelPanel } from "@/components/advertiser/campaign-tracking-pixel-panel";
import { Button } from "@/components/ui/button";
import { SHOW_CAMPAIGN_TRACKING_PIXEL_UI } from "@/lib/campaign-pixel-ui";

export function CampaignPixelButton({
  campaignId,
  campaignName,
  pixelToken: initialPixelToken,
}: {
  campaignId: string;
  campaignName: string;
  pixelToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pixelToken, setPixelToken] = useState(initialPixelToken);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!SHOW_CAMPAIGN_TRACKING_PIXEL_UI || !open || pixelToken) return;

    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/campaigns/${campaignId}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          setPixelToken(body?.data?.pixelToken ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pixelToken, campaignId]);

  if (!SHOW_CAMPAIGN_TRACKING_PIXEL_UI) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-md border-border text-xs"
        onClick={() => setOpen(true)}
      >
        <Crosshair className="mr-1 h-3.5 w-3.5" />
        Pixel
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tracking pixel
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{campaignName}</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
            {loading && <p className="text-sm text-muted-foreground">Loading pixel...</p>}
            {!loading && pixelToken && <CampaignTrackingPixelPanel pixelToken={pixelToken} compact />}
            {!loading && !pixelToken && (
              <p className="text-sm text-red-600">Unable to load tracking pixel for this campaign.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
