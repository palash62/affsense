"use client";

import { useMemo, useState } from "react";
import { buildCpaOfferTrackingUrl, getTrackingUrl } from "@cpl/shared";
import { Check, Copy, Link2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

type CpaOfferTrackingLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: SerializedCpaOffer | null;
  advertiserId: string;
};

export function CpaOfferTrackingLinkDialog({
  open,
  onOpenChange,
  offer,
  advertiserId,
}: CpaOfferTrackingLinkDialogProps) {
  const [includeParams, setIncludeParams] = useState(false);
  const [src, setSrc] = useState("");
  const [subId, setSubId] = useState("");
  const [copied, setCopied] = useState(false);

  const trackingDomain = useMemo(() => {
    try {
      return new URL(getTrackingUrl()).origin + "/";
    } catch {
      return getTrackingUrl();
    }
  }, []);

  const trackingLink = useMemo(() => {
    if (!offer) return "";
    return buildCpaOfferTrackingUrl(offer.id, {
      advertiserId: advertiserId || undefined,
      src: includeParams ? src.trim() || undefined : undefined,
      subId: includeParams ? subId.trim() || undefined : undefined,
    });
  }, [offer, advertiserId, includeParams, src, subId]);

  async function copyLink() {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!offer) return null;

  const shortId = offer.id.slice(-6);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">
            ({shortId})-{offer.name}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <span className="font-medium">Tracking Link</span>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
            <span className="font-mono text-xs text-muted-foreground">OFFER #{offer.id}</span>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-start gap-2">
              <Settings2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Configure your link</p>
                <p className="text-xs text-muted-foreground">
                  Choose a tracking domain and optional landing page.
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tracking domain</Label>
              <Input readOnly value={trackingDomain} className="bg-muted font-mono text-xs" />
              <p className="text-xs text-muted-foreground">
                Select the domain that will appear in your tracking URL.
              </p>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 text-sky-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your generated links</p>
                    <p className="text-xs text-muted-foreground">
                      Copy the link you need and use it in your campaigns.
                    </p>
                  </div>
                  <Button type="button" size="sm" className="gap-1.5" onClick={copyLink}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied!" : "Copy Tracking Link"}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tracking Link
              </p>
              <p className="text-xs text-muted-foreground">Full tracking URL with all selected parameters.</p>
              <div className="rounded-lg border border-sky-200 bg-card px-3 py-2.5 font-mono text-xs break-all text-foreground">
                {trackingLink}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Optional parameters</p>
              <p className="text-xs text-muted-foreground">
                Add sub-IDs, source tags, or other params before copying.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={includeParams}
                onChange={(e) => setIncludeParams(e.target.checked)}
                className="rounded border-border"
              />
              Add tracking parameters (sub-IDs & source)
            </label>
            {includeParams ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cpa-src">Source (src)</Label>
                  <Input
                    id="cpa-src"
                    value={src}
                    onChange={(e) => setSrc(e.target.value)}
                    placeholder="facebook"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cpa-sub">Sub ID</Label>
                  <Input
                    id="cpa-sub"
                    value={subId}
                    onChange={(e) => setSubId(e.target.value)}
                    placeholder="campaign-a"
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
