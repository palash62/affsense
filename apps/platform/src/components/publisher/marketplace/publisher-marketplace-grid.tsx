"use client";

import { Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SerializedPublisherDigitalProduct } from "@/services/digital-product.service";

export function PublisherMarketplaceGrid({
  products,
  onPromote,
}: {
  products: SerializedPublisherDigitalProduct[];
  onPromote: (product: SerializedPublisherDigitalProduct) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <PublisherMarketplaceCard key={product.id} product={product} onPromote={onPromote} />
      ))}
    </div>
  );
}

function PublisherMarketplaceCard({
  product,
  onPromote,
}: {
  product: SerializedPublisherDigitalProduct;
  onPromote: (product: SerializedPublisherDigitalProduct) => void;
}) {
  const letter = (product.name.trim()[0] || "?").toUpperCase();

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card",
        "shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-4xl font-bold text-white",
              product.thumbTone,
            )}
          >
            {letter}
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex flex-wrap gap-1.5 p-3">
          {product.featured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
              Featured
            </span>
          ) : null}
          {product.isNew ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_80%,black)]/80 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
              <Sparkles className="h-3 w-3" />
              New
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {product.name}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {product.category} · {product.niche} · {product.productType}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold tracking-tight text-foreground">
            ${product.price.toFixed(2)}
          </span>
          <span className="inline-flex rounded-md bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--theme-primary)]">
            {product.frontEndCommission}% commission
          </span>
        </div>

        {product.vendor ? (
          <p className="truncate text-xs text-muted-foreground">{product.vendor}</p>
        ) : null}

        <Button
          type="button"
          size="sm"
          className="mt-auto h-9 w-full rounded-md bg-[var(--theme-primary)] hover:opacity-90"
          onClick={() => onPromote(product)}
        >
          Promote
        </Button>
      </div>
    </article>
  );
}
