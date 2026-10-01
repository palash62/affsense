"use client";

import { useCallback, useState } from "react";
import { buildDigitalProductTrackingUrl } from "@cpl/shared";
import { Copy, ExternalLink, Package, Pencil, Sparkles, Star } from "lucide-react";
import { toast } from "sonner";
import {
  AffiliateTrackingLinkCard,
  type AffiliateTrackingExtras,
} from "@/components/admin/affiliate-tracking-link-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SerializedDigitalProduct } from "@/services/digital-product.service";
import {
  AFFILIATE_TRACKING_SAMPLE_VALUE,
  buildAffiliateTrackingPreviewUrl,
  derivePageSlugFromUrl,
} from "./digital-product-types";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-foreground">{children}</dd>
    </div>
  );
}

const MAIN_PAGE_ID = "main";

export function AdminDigitalProductDetailPage({
  product,
}: {
  product: SerializedDigitalProduct;
}) {
  const letter = (product.name.trim()[0] || "?").toUpperCase();
  const trackingParam = product.affiliateTrackingParam?.trim() || "affsense_id";
  const salesPages = [
    ...(product.salesPageUrl?.trim()
      ? [{ id: MAIN_PAGE_ID, name: "Main sales page", pageUrl: product.salesPageUrl.trim() }]
      : []),
    ...product.salesPages.filter((page) => page.pageUrl.trim()),
  ];

  const [selectedPageId, setSelectedPageId] = useState(salesPages[0]?.id ?? MAIN_PAGE_ID);
  const selectedPage = salesPages.find((page) => page.id === selectedPageId) ?? salesPages[0];
  const pageId = selectedPage && selectedPage.id !== MAIN_PAGE_ID ? selectedPage.id : undefined;

  const buildAffiliateUrl = useCallback(
    (publisherId: string, extras: AffiliateTrackingExtras) =>
      buildDigitalProductTrackingUrl(product.id, {
        publisherId,
        src: extras.src,
        subId: extras.subId,
        pageId,
      }),
    [product.id, pageId],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title={product.name}
        description={product.shortDescription || undefined}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Digital Products", href: "/admin/digital-products" },
          { label: product.name },
        ]}
        badge={
          <span
            className={cn(
              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
              product.status === "Active"
                ? "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]"
                : "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[var(--warning)]",
            )}
          >
            {product.status}
          </span>
        }
      >
        <ButtonLink
          href={`/admin/digital-products/${product.id}/edit`}
          className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
        >
          <Pencil className="h-4 w-4" />
          Edit product
        </ButtonLink>
      </PageHeader>

      <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="h-32 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center bg-gradient-to-br text-4xl font-bold text-white",
                  product.thumbTone ||
                    "from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)]",
                )}
              >
                {letter}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">Product overview</h2>
              {product.featured ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  Featured
                </span>
              ) : null}
              {product.isNew ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--theme-primary)]">
                  <Sparkles className="h-3 w-3" />
                  New
                </span>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              <Stat label="Type">{product.productType}</Stat>
              <Stat label="Category">{product.category}</Stat>
              <Stat label="Vendor">{product.vendor || "—"}</Stat>
              <Stat label="Price (FE)">${product.price.toFixed(2)}</Stat>
              <Stat label="Front end commission">
                <span className="text-[var(--theme-success)]">{product.frontEndCommission}%</span>
              </Stat>
              <Stat label="Referral reward">{product.referralReward ?? 0}%</Stat>
            </dl>
          </div>
        </div>
      </section>

      <AffiliateTrackingLinkCard
        description="Pick an affiliate to get the exact tracking link they would use for this product."
        buildUrl={buildAffiliateUrl}
        unavailableMessage={
          salesPages.length === 0
            ? "Add a sales page URL to this product before generating tracking links."
            : undefined
        }
      >
        {salesPages.length > 1 ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Sales page</Label>
            <Select
              value={selectedPage?.id ?? null}
              onValueChange={(v) => {
                if (v) setSelectedPageId(v);
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-lg bg-card">
                <SelectValue>
                  {(value: string | null) =>
                    salesPages.find((page) => page.id === value)?.name ?? "Select sales page"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {salesPages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </AffiliateTrackingLinkCard>

      <Section
        title="Sales pages"
        description={`Affiliates are redirected to the page they pick, with ?${trackingParam}= set to their publisher id.`}
      >
        {salesPages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
            No sales page URL yet. Edit the product to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {salesPages.map((page) => {
              const tracked = buildAffiliateTrackingPreviewUrl(page.pageUrl, trackingParam);
              return (
                <div key={page.id} className="rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{page.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Page slug:{" "}
                        <code className="rounded bg-muted px-1">
                          {derivePageSlugFromUrl(page.pageUrl) ?? "—"}
                        </code>
                      </p>
                    </div>
                    <ButtonLink
                      href={page.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                    >
                      Preview
                      <ExternalLink className="h-3.5 w-3.5" />
                    </ButtonLink>
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-foreground">{page.pageUrl}</p>
                  {tracked ? (
                    <div className="mt-2 flex items-center gap-2">
                      <p className="min-w-0 flex-1 break-all rounded-md bg-muted px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                        {tracked}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => void copyText(tracked, "Tracked URL")}
                        aria-label={`Copy tracked URL for ${page.name}`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1">{AFFILIATE_TRACKING_SAMPLE_VALUE}</code> is
              replaced with each publisher&apos;s id in their tracking link.
            </p>
          </div>
        )}

        {product.previewUrl?.trim() ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Preview / Demo URL</p>
              <p className="break-all font-mono text-xs text-muted-foreground">{product.previewUrl}</p>
            </div>
            <ButtonLink
              href={product.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
            >
              Open demo
              <ExternalLink className="h-3.5 w-3.5" />
            </ButtonLink>
          </div>
        ) : null}
      </Section>

      <Section title="Upsells" description="Upsell pages matched by page slug from the ClickFunnels webhook.">
        {product.upsells.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upsells configured.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="bg-[var(--sidebar,#07162D)] text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Page slug</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Commission</th>
                </tr>
              </thead>
              <tbody>
                {product.upsells.map((upsell, index) => (
                  <tr
                    key={upsell.id}
                    className={cn("border-t border-border", index % 2 === 0 ? "bg-card" : "bg-muted/20")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <Package className="h-3.5 w-3.5" />
                        </span>
                        <a
                          href={upsell.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-foreground hover:text-[var(--theme-primary)] hover:underline"
                        >
                          {upsell.name}
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="rounded bg-muted px-1 text-xs">{upsell.pageSlug}</code>
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      ${upsell.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--theme-success)]">
                      {upsell.commissionPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
