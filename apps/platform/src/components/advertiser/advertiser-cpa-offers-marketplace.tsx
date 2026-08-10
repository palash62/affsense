"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Link2, MoreHorizontal, Search } from "lucide-react";
import { CpaOfferTrackingLinkDialog } from "@/components/advertiser/cpa-offer-tracking-link-dialog";
import { CpaOfferCard, CpaOfferCardGrid } from "@/components/cpa/cpa-offer-card";
import { RoleHero } from "@/components/layout/role-hero";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { CpaOfferListResult, SerializedCpaOffer } from "@/services/cpa-offer.service";

const PAGE_SIZE = 25;

type AppliedFilters = {
  offerId: string;
  q: string;
  category: string;
};

const emptyFilters: AppliedFilters = {
  offerId: "",
  q: "",
  category: "",
};

export function AdvertiserCpaOffersMarketplace() {
  const router = useRouter();
  const { data: session } = useSession();
  const advertiserId = session?.user?.id ?? "";

  const [result, setResult] = useState<CpaOfferListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [trackingOffer, setTrackingOffer] = useState<SerializedCpaOffer | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (applied.offerId.trim()) params.set("id", applied.offerId.trim());
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.category.trim()) params.set("category", applied.category.trim());

    const res = await fetch(`/api/v1/advertiser/cpa-offers?${params}`);
    const body = await res.json().catch(() => ({}));
    setResult(body.data ?? null);
    setLoading(false);
  }, [page, applied]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  function applyFilters() {
    setPage(1);
    setApplied({ ...draft });
  }

  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }

  const items = result?.items ?? [];
  const totalPages = result?.totalPages ?? 1;
  const total = result?.total ?? 0;

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Advertiser Portal"
        title={`Available Offers (${total})`}
        description="Browse active CPA offers and copy personalized tracking links for your campaigns."
      />

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="w-full space-y-1 sm:w-40">
            <label className="text-xs font-medium text-muted-foreground">Offer ID</label>
            <Input
              value={draft.offerId}
              onChange={(e) => setDraft((prev) => ({ ...prev, offerId: e.target.value }))}
              placeholder="Offer ID"
            />
          </div>
          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Offer Title</label>
            <Input
              value={draft.q}
              onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
              placeholder="Offer title"
            />
          </div>
          <div className="w-full space-y-1 sm:w-36">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <Input
              value={draft.category}
              onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Category"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear Filter
            </Button>
            <Button type="button" className="gap-1.5" onClick={applyFilters}>
              <Search className="h-4 w-4" />
              Apply
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Loading offers…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No active offers. Check back later — new CPA offers appear here when published.
        </div>
      ) : (
        <CpaOfferCardGrid>
          {items.map((offer) => (
            <CpaOfferCard
              key={offer.id}
              offer={offer}
              footer={
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => setTrackingOffer(offer)}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Tracking Link
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted"
                      aria-label="More offer actions"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/advertiser/cpa-offers/${offer.id}`)}
                      >
                        View details
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />
          ))}
        </CpaOfferCardGrid>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Showing {items.length} of {total} items
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <CpaOfferTrackingLinkDialog
        open={Boolean(trackingOffer)}
        onOpenChange={(open) => {
          if (!open) setTrackingOffer(null);
        }}
        offer={trackingOffer}
        advertiserId={advertiserId}
      />
    </div>
  );
}
