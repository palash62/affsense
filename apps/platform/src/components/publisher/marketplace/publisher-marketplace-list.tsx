"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { PublisherMarketplaceFilters } from "./publisher-marketplace-filters";
import { PublisherMarketplaceGrid } from "./publisher-marketplace-grid";
import { PublisherProductDetailSheet } from "./publisher-product-detail-sheet";
import type { SerializedPublisherDigitalProduct } from "@/services/digital-product.service";

function PublisherMarketplaceListInner() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<SerializedPublisherDigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    const category = searchParams.get("category");
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    params.set("limit", "200");
    return params.toString();
  }, [searchParams]);

  const loadProducts = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/publisher/digital-products?${queryString}`)
      .then((r) => r.json())
      .then((json) => {
        setProducts(json.data?.items ?? []);
      })
      .catch(() => {
        toast.error("Failed to load products");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [queryString]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const productId = searchParams.get("product");
    if (productId) {
      setSelectedProductId(productId);
      setSheetOpen(true);
    }
  }, [searchParams]);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products],
  );

  const hasFilters = Boolean(searchParams.get("q") || searchParams.get("category"));
  const total = products.length;

  function openProduct(product: SerializedPublisherDigitalProduct) {
    setSelectedProductId(product.id);
    setSheetOpen(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse digital products to promote. Copy your tracked link and share it with your audience.
        </p>
      </div>

      <PublisherMarketplaceFilters categories={categories} />

      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? `Showing ${total} matching product${total === 1 ? "" : "s"}`
          : `${total} product${total === 1 ? "" : "s"} available to promote`}
      </p>

      {loading ? (
        <div className="h-64 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <PackageOpen className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No products match your filters" : "No products available yet"}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting your search or category filter."
              : "Check back soon — new digital products will appear here when admins publish them."}
          </p>
        </div>
      ) : (
        <PublisherMarketplaceGrid products={products} onPromote={openProduct} />
      )}

      <PublisherProductDetailSheet
        productId={selectedProductId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}

export function PublisherMarketplaceList() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />}
    >
      <PublisherMarketplaceListInner />
    </Suspense>
  );
}
