"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildDigitalProductAffiliateUrl } from "@/lib/digital-product-affiliate-url";
import type { SerializedPublisherDigitalProduct } from "@/services/digital-product.service";

export function PublisherProductDetailSheet({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const [product, setProduct] = useState<SerializedPublisherDigitalProduct | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !productId) {
      setProduct(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/publisher/digital-products/${productId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setProduct(json.data ?? null);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load product details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, productId]);

  const publisherId = session?.user?.id ?? "";
  const trackedUrl = useMemo(() => {
    if (!product || !publisherId) return null;
    return buildDigitalProductAffiliateUrl(
      product.salesPageUrl,
      product.affiliateTrackingParam,
      publisherId,
    );
  }, [product, publisherId]);

  const trackingParam = product?.affiliateTrackingParam?.trim() || "affsense_id";

  async function copyTrackedUrl() {
    if (!trackedUrl) {
      toast.error("Sales page URL is not configured for this product");
      return;
    }
    try {
      await navigator.clipboard.writeText(trackedUrl);
      toast.success("Tracked link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{product?.name ?? "Product details"}</SheetTitle>
          <SheetDescription>
            {product
              ? `${product.category} · ${product.productType} · $${product.price.toFixed(2)}`
              : "Loading product..."}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : product ? (
          <div className="space-y-5 px-4 pb-6">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="aspect-[16/10] w-full rounded-lg border border-border object-cover"
              />
            ) : null}

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-[var(--theme-primary-soft)] px-2 py-1 font-semibold text-[var(--theme-primary)]">
                {product.frontEndCommission}% front-end commission
              </span>
              {product.upsellCommission != null ? (
                <span className="rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground">
                  {product.upsellCommission}% upsell
                </span>
              ) : null}
            </div>

            {product.shortDescription ? (
              <p className="text-sm text-muted-foreground">{product.shortDescription}</p>
            ) : null}

            {product.vendor ? (
              <div className="text-sm">
                <p className="font-semibold text-foreground">Vendor</p>
                <p className="mt-1 text-muted-foreground">{product.vendor}</p>
              </div>
            ) : null}

            {product.previewUrl ? (
              <ButtonLink
                href={product.previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
              >
                Preview sales page
                <ExternalLink className="h-3.5 w-3.5" />
              </ButtonLink>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Your tracked link</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share this URL so sales can be attributed to you via{" "}
                  <code className="rounded bg-muted px-1 py-0.5">{trackingParam}</code>.
                </p>
              </div>

              {trackedUrl ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="trackedUrl" className="sr-only">
                      Tracked URL
                    </Label>
                    <Input
                      id="trackedUrl"
                      readOnly
                      value={trackedUrl}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
                      onClick={copyTrackedUrl}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy link
                    </Button>
                    <ButtonLink
                      href={trackedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5"
                    >
                      Open
                      <ExternalLink className="h-3.5 w-3.5" />
                    </ButtonLink>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--warning)]">
                  This product does not have a sales page URL yet. Ask an admin to add one before
                  you can promote it.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
