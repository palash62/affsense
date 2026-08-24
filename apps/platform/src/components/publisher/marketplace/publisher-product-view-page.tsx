"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SMART_LINK_PLATFORMS } from "@/lib/smart-link";
import { buildDigitalProductAffiliateUrl } from "@/lib/digital-product-affiliate-url";
import type { SerializedPublisherDigitalProduct } from "@/services/digital-product.service";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function PublisherProductViewPage({
  product,
  publisherId,
}: {
  product: SerializedPublisherDigitalProduct;
  publisherId: string;
}) {
  const [source, setSource] = useState("none");
  const [customSource, setCustomSource] = useState("");
  const [subId, setSubId] = useState("");
  const [campaign, setCampaign] = useState("");

  const sourceValue = source === "other" ? customSource : source === "none" ? "" : source;

  const primaryUrl = useMemo(
    () =>
      buildDigitalProductAffiliateUrl(
        product.salesPageUrl,
        product.affiliateTrackingParam,
        publisherId,
      ),
    [product.salesPageUrl, product.affiliateTrackingParam, publisherId],
  );

  const previewUrl = useMemo(
    () =>
      buildDigitalProductAffiliateUrl(
        product.salesPageUrl,
        product.affiliateTrackingParam,
        publisherId,
        { source: sourceValue, subid: subId, campaign },
      ),
    [
      product.salesPageUrl,
      product.affiliateTrackingParam,
      publisherId,
      sourceValue,
      subId,
      campaign,
    ],
  );

  const funnelUrl = product.previewUrl?.trim() || product.salesPageUrl?.trim() || null;
  const letter = (product.name.trim()[0] || "?").toUpperCase();
  const frontEndAmount = (product.price * product.frontEndCommission) / 100;
  const upsellAmount =
    product.upsellCommission != null
      ? (product.price * product.upsellCommission) / 100
      : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/publisher/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Marketplace
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{product.name}</h1>
          <span className="inline-flex rounded-full bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-success)]">
            Active
          </span>
        </div>
        {product.shortDescription ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{product.shortDescription}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-28 sm:w-36">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className={cn(
                    "flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-3xl font-bold text-white",
                    product.thumbTone,
                  )}
                >
                  {letter}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">Product overview</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="font-medium text-foreground">{product.productType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Price</dt>
                  <dd className="font-medium text-foreground">${product.price.toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Category</dt>
                  <dd className="truncate font-medium text-foreground">{product.category}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Niche</dt>
                  <dd className="truncate font-medium text-foreground">{product.niche}</dd>
                </div>
                {product.vendor ? (
                  <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Vendor</dt>
                    <dd className="truncate font-medium text-foreground">{product.vendor}</dd>
                  </div>
                ) : null}
              </dl>
              {funnelUrl ? (
                <ButtonLink
                  href={funnelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                  className="mt-4 h-8 gap-1.5"
                >
                  View funnel
                  <ExternalLink className="h-3.5 w-3.5" />
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="text-sm font-semibold text-foreground">Commission structure</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Front end</p>
              <p className="mt-0.5 text-lg font-bold text-foreground">
                {product.frontEndCommission}%
                <span className="ml-2 text-sm font-semibold text-muted-foreground">
                  ${frontEndAmount.toFixed(2)}
                </span>
              </p>
            </div>
            {product.upsellCommission != null ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Upsell</p>
                <p className="mt-0.5 text-lg font-bold text-foreground">
                  {product.upsellCommission}%
                  <span className="ml-2 text-sm font-semibold text-muted-foreground">
                    ${upsellAmount?.toFixed(2)}
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No upsell commission configured.</p>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-semibold text-foreground">Your affiliate link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this URL so sales can be attributed to you via{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {product.affiliateTrackingParam?.trim() || "affsense_id"}
          </code>
          .
        </p>

        {primaryUrl ? (
          <div className="mt-4 space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input readOnly value={primaryUrl} className="h-10 font-mono text-xs" />
              <Button
                type="button"
                className="h-10 shrink-0 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
                onClick={() => void copyText(primaryUrl, "Affiliate link")}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </Button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Link settings</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add source, sub ID, and campaign so you can see which traffic converts.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="aff-source">Source</Label>
                  <Select
                    value={source}
                    onValueChange={(v) => {
                      if (!v) return;
                      setSource(v);
                    }}
                  >
                    <SelectTrigger id="aff-source" className="h-10 w-full">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No source</SelectItem>
                      {SMART_LINK_PLATFORMS.map((platform) => (
                        <SelectItem key={platform.id} value={platform.id}>
                          {platform.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {source === "other" ? (
                    <Input
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                      placeholder="custom-source"
                      className="h-9 font-mono text-xs"
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-subid">Sub ID</Label>
                  <Input
                    id="aff-subid"
                    value={subId}
                    onChange={(e) => setSubId(e.target.value)}
                    placeholder="video1"
                    className="h-10 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aff-campaign">Campaign</Label>
                  <Input
                    id="aff-campaign"
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                    placeholder="spring_promo"
                    className="h-10 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Your link preview</p>
                  <p className="text-xs text-muted-foreground">
                    Updates as you change source, sub ID, and campaign.
                  </p>
                </div>
                {previewUrl ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => void copyText(previewUrl, "Preview link")}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 break-all font-mono text-xs text-foreground">{previewUrl}</p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Tips</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                <li>Source tags the traffic channel (YouTube, Facebook, email).</li>
                <li>Sub ID is for a specific ad, video, or placement.</li>
                <li>Campaign groups a promotion, such as a seasonal push.</li>
                <li>Use letters, numbers, hyphens, and underscores only.</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-[var(--warning)]">
            This product does not have a sales page URL yet. Ask an admin to add one before you
            can promote it.
          </p>
        )}
      </section>
    </div>
  );
}
