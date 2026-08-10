"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PackageOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { DigitalProductCard } from "./digital-product-card";
import { DigitalProductsFilters } from "./digital-products-filters";
import {
  filterDigitalProducts,
  loadMockDigitalProducts,
  type DigitalProductListItem,
} from "./mock-data";

function DigitalProductsListInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [products, setProducts] = useState<DigitalProductListItem[]>([]);

  useEffect(() => {
    setProducts(loadMockDigitalProducts());
  }, []);

  const filters = useMemo(
    () => ({
      q: searchParams.get("q") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      type: searchParams.get("type") ?? undefined,
    }),
    [searchParams],
  );

  const filtered = useMemo(
    () => filterDigitalProducts(products, filters),
    [products, filters],
  );

  const total = products.length;
  const shown = filtered.length;
  const hasFilters = Boolean(
    filters.q || filters.status || filters.category || filters.type,
  );

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <div className="space-y-5">
      <DigitalProductsFilters />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `Showing ${shown} of ${total} product${total === 1 ? "" : "s"}`
            : `${total} product${total === 1 ? "" : "s"}`}
        </p>
        <ButtonLink
          href="/admin/digital-products/new"
          className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </ButtonLink>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <PackageOpen className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No products match your filters" : "No digital products yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting search or filters to see more offers."
              : "Create your first digital product offer to get started."}
          </p>
          {hasFilters ? (
            <Button
              type="button"
              variant="outline"
              className="mt-5 h-9 rounded-md"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : (
            <ButtonLink
              href="/admin/digital-products/new"
              className="mt-5 h-9 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </ButtonLink>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((product) => (
            <DigitalProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DigitalProductsList() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-14 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/5] animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted"
              />
            ))}
          </div>
        </div>
      }
    >
      <DigitalProductsListInner />
    </Suspense>
  );
}
