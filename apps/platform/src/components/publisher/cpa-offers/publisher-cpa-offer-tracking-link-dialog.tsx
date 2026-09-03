"use client";

import { useMemo, useState } from "react";
import { buildCpaOfferTrackingUrl } from "@cpl/shared";
import { Check, Copy, Link2 } from "lucide-react";
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

type PublisherCpaOfferTrackingLinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: SerializedCpaOffer | null;
  publisherId: string;
};

export function PublisherCpaOfferTrackingLinkDialog({
  open,
  onOpenChange,
  offer,
  publisherId,
}: PublisherCpaOfferTrackingLinkDialogProps) {
  const [includeParams, setIncludeParams] = useState(false);
  const [src, setSrc] = useState("");
  const [subId, setSubId] = useState("");
  const [copied, setCopied] = useState(false);

  const trackingLink = useMemo(() => {
    if (!offer) return "";
    return buildCpaOfferTrackingUrl(offer.id, {
      publisherId: publisherId || undefined,
      src: includeParams ? src.trim() || undefined : undefined,
      subId: includeParams ? subId.trim() || undefined : undefined,
    });
  }, [offer, publisherId, includeParams, src, subId]);

  async function copyLink() {
    if (!trackingLink) return;
    await navigator.clipboard.writeText(trackingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!offer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base leading-snug">{offer.name}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <span className="font-medium">Tracking Link</span>
            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
            <span className="font-mono text-xs text-muted-foreground">OFFER #{offer.id}</span>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 text-sky-700" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Your generated links</p>
                    <p className="text-xs text-muted-foreground">
                      Copy the link and share it with your audience.
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
              <div className="rounded-lg border border-sky-200 bg-card px-3 py-2.5 font-mono text-xs break-all text-foreground">
                {trackingLink}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Optional parameters</p>
              <p className="text-xs text-muted-foreground">
                Add sub-IDs or source tags before copying.
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
                  <Label htmlFor="pub-cpa-src">Source (src)</Label>
                  <Input
                    id="pub-cpa-src"
                    value={src}
                    onChange={(e) => setSrc(e.target.value)}
                    placeholder="facebook"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-cpa-sub">Sub ID</Label>
                  <Input
                    id="pub-cpa-sub"
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
