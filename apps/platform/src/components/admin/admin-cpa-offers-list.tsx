"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MoreHorizontal, Pencil, Plus, Store, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminCpaOffersFilters } from "@/components/admin/admin-cpa-offers-filters";
import { CpaOfferCard, CpaOfferCardGrid } from "@/components/cpa/cpa-offer-card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { readApiErrorMessage } from "@/lib/errors";
import type { CpaOfferListResult, SerializedCpaOffer } from "@/services/cpa-offer.service";

const PAGE_SIZE = 20;

function AdminCpaOffersListInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [result, setResult] = useState<CpaOfferListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      status: searchParams.get("status") ?? "ALL",
      category: searchParams.get("category") ?? "",
      network: searchParams.get("network") ?? "",
    }),
    [searchParams],
  );

  const hasFilters = Boolean(
    filters.q ||
      (filters.status && filters.status !== "ALL") ||
      filters.category ||
      filters.network,
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.q, filters.status, filters.category, filters.network]);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (filters.q.trim()) params.set("q", filters.q.trim());
    if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
    if (filters.network.trim()) params.set("network", filters.network.trim());
    if (filters.category.trim()) params.set("category", filters.category.trim());

    const res = await fetch(`/api/v1/admin/cpa-offers?${params}`);
    const body = await res.json().catch(() => ({}));
    setResult(body.data ?? null);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  function clearFilters() {
    router.push(pathname);
  }

  async function handleDelete(offer: SerializedCpaOffer) {
    if (!window.confirm(`Delete "${offer.name}"?`)) return;
    setDeletingId(offer.id);
    try {
      const res = await fetch(`/api/v1/admin/cpa-offers/${offer.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to delete offer.", res.status));
      }
      toast.success("Offer deleted");
      await loadOffers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;
  const total = result?.total ?? 0;

  return (
    <div className="space-y-5">
      <AdminCpaOffersFilters />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `Showing ${items.length} of ${total} offer${total === 1 ? "" : "s"}`
            : `${total} offer${total === 1 ? "" : "s"}`}
        </p>
        <ButtonLink
          href="/admin/cpa-offers/new"
          className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add Offer
        </ButtonLink>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]"
            >
              <div className="aspect-[16/10] animate-pulse bg-muted" />
              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-8 w-full animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <Store className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No offers match your filters" : "No CPA offers yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting search or filters to see more offers."
              : "Create your first CPA offer to populate the marketplace."}
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
              href="/admin/cpa-offers/new"
              className="mt-5 h-9 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add Offer
            </ButtonLink>
          )}
        </div>
      ) : (
        <CpaOfferCardGrid>
          {items.map((offer) => (
            <CpaOfferCard
              key={offer.id}
              offer={offer}
              showRevenue
              showAdvertiser
              showVisibility
              footer={
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 gap-1.5 rounded-md bg-[var(--theme-primary)] hover:opacity-90"
                    onClick={() => router.push(`/admin/cpa-offers/${offer.id}/edit`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
                      aria-label="Offer actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/admin/cpa-offers/${offer.id}/edit`)}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={deletingId === offer.id}
                        onClick={() => handleDelete(offer)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          ))}
        </CpaOfferCardGrid>
      )}

      {!loading && totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-[var(--radius-card,0.875rem)] border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {total} items
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-md"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-md"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminCpaOffersList() {
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
      <AdminCpaOffersListInner />
    </Suspense>
  );
}
