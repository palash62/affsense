"use client";

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Package } from "lucide-react";
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
import { buildDigitalProductTrackingUrl } from "@cpl/shared";
import type { SerializedPublisherDigitalProduct } from "@/services/digital-product.service";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

const MAIN_PAGE_ID = "main";

function formatCommissionCell(price: number, percent: number) {
  const amount = (price * percent) / 100;
  return `$${amount.toFixed(2)} (${percent}%)`;
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
  const [subIds, setSubIds] = useState(["", "", "", ""]);
  const [campaign, setCampaign] = useState("");

  const [selectedPageId, setSelectedPageId] = useState(MAIN_PAGE_ID);

  const sourceValue = source === "other" ? customSource : source === "none" ? "" : source;

  const salesPages = useMemo(() => {
    const pages: Array<{ id: string; name: string; pageUrl: string }> = [];
    if (product.salesPageUrl?.trim()) {
      pages.push({ id: MAIN_PAGE_ID, name: "Main sales page", pageUrl: product.salesPageUrl.trim() });
    }
    for (const page of product.salesPages) {
      if (page.pageUrl.trim()) pages.push(page);
    }
    return pages;
  }, [product.salesPageUrl, product.salesPages]);

  const selectedPage = salesPages.find((page) => page.id === selectedPageId) ?? salesPages[0] ?? null;
  const pageId = selectedPage && selectedPage.id !== MAIN_PAGE_ID ? selectedPage.id : undefined;

  const primaryUrl = useMemo(() => {
    if (!publisherId.trim() || !selectedPage) return null;
    return buildDigitalProductTrackingUrl(product.id, { publisherId, pageId });
  }, [product.id, publisherId, selectedPage, pageId]);

  const previewUrl = useMemo(() => {
    if (!publisherId.trim() || !selectedPage) return null;
    return buildDigitalProductTrackingUrl(product.id, {
      publisherId,
      src: sourceValue || undefined,
      subId: subIds[0].trim() || undefined,
      subId2: subIds[1].trim() || undefined,
      subId3: subIds[2].trim() || undefined,
      subId4: subIds[3].trim() || undefined,
      campaign: campaign || undefined,
      pageId,
    });
  }, [product.id, publisherId, selectedPage, pageId, sourceValue, subIds, campaign]);

  function setSubIdAt(index: number, value: string) {
    setSubIds((prev) => prev.map((current, i) => (i === index ? value : current)));
  }

  const funnelUrl = product.previewUrl?.trim() || product.salesPageUrl?.trim() || null;
  const letter = (product.name.trim()[0] || "?").toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Type</dt>
                <dd className="font-medium text-foreground">{product.productType}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Price</dt>
                <dd className="font-medium text-foreground">${product.price.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Front end commission</dt>
                <dd className="flex items-center gap-1.5 font-medium text-[var(--theme-success)]">
                  {product.frontEndCommission}%
                  {product.hasCommissionPlan ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Your custom rate
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Category</dt>
                <dd className="truncate font-medium text-foreground">{product.category}</dd>
              </div>
              {product.vendor ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Vendor</dt>
                  <dd className="truncate font-medium text-foreground">{product.vendor}</dd>
                </div>
              ) : null}
              {product.lifetimeCookie ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Cookie</dt>
                  <dd className="font-medium text-[var(--theme-success)]">Lifetime</dd>
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
        <h2 className="text-sm font-semibold text-foreground">Your affiliate link</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Share this Affsense tracking URL. It redirects to the sales page with{" "}
          <code className="rounded bg-muted px-1 py-0.5">
            {product.affiliateTrackingParam?.trim() || "affsense_id"}
          </code>{" "}
          so sales can be attributed to you.
        </p>

        {primaryUrl ? (
          <div className="mt-4 space-y-5">
            {salesPages.length > 1 ? (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Sales page</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose which sales page your link sends visitors to. Preview each page before
                  picking one.
                </p>
                <div
                  role="radiogroup"
                  aria-label="Sales page"
                  className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {salesPages.map((page) => {
                    const selected = page.id === selectedPage?.id;
                    return (
                      <div
                        key={page.id}
                        role="radio"
                        aria-checked={selected}
                        tabIndex={0}
                        onClick={() => setSelectedPageId(page.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedPageId(page.id);
                          }
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors",
                          selected
                            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                            : "border-border bg-card hover:bg-muted/40",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-[var(--theme-primary)]" : "border-border",
                            )}
                          >
                            {selected ? (
                              <span className="h-2 w-2 rounded-full bg-[var(--theme-primary)]" />
                            ) : null}
                          </span>
                          <span
                            className={cn(
                              "truncate text-sm font-medium",
                              selected ? "text-[var(--theme-primary)]" : "text-foreground",
                            )}
                          >
                            {page.name}
                          </span>
                        </div>
                        <a
                          href={page.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Preview
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

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
              {selectedPage ? (
                <ButtonLink
                  href={selectedPage.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  className="h-10 shrink-0 gap-1.5"
                >
                  Preview page
                  <ExternalLink className="h-3.5 w-3.5" />
                </ButtonLink>
              ) : null}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Link settings</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add source, campaign, and up to four sub IDs so you can see which traffic converts.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {subIds.map((value, index) => (
                  <div key={index} className="space-y-1.5">
                    <Label htmlFor={`aff-subid${index + 1}`}>Sub ID {index + 1}</Label>
                    <Input
                      id={`aff-subid${index + 1}`}
                      value={value}
                      onChange={(e) => setSubIdAt(index, e.target.value)}
                      placeholder={index === 0 ? "video1" : `sub${index + 1}`}
                      className="h-10 font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Your link preview</p>
                  <p className="text-xs text-muted-foreground">
                    Updates as you change source, campaign, and sub IDs.
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
                <li>Sub ID 1-4 tag a specific ad, video, or placement — use as many as you need.</li>
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

      <section className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Products</h2>
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sidebar,#07162D)] px-1.5 text-[11px] font-semibold text-white">
                {1 + product.upsells.length}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Front-end offer and every upsell with price and your commission.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="bg-[var(--sidebar,#07162D)] text-left text-xs font-semibold uppercase tracking-wide text-white">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 text-right font-semibold">Price</th>
                <th className="px-4 py-3 text-right font-semibold">Commission</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border bg-card transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{product.name}</p>
                      <p className="text-[11px] text-muted-foreground">Front end</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                  ${product.price.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--theme-success)]">
                  {formatCommissionCell(product.price, product.frontEndCommission)}
                </td>
              </tr>
              {product.upsells.map((upsell, index) => (
                <tr
                  key={`${upsell.name}-${index}`}
                  className={cn(
                    "border-t border-border transition-colors hover:bg-muted/40",
                    index % 2 === 0 ? "bg-muted/20" : "bg-card",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{upsell.name}</p>
                        <p className="text-[11px] text-muted-foreground">Upsell {index + 1}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                    ${upsell.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--theme-success)]">
                    {formatCommissionCell(upsell.price, upsell.commissionPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
