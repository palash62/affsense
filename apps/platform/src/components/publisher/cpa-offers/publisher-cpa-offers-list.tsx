"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Link2, Lock, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { PublisherCpaOfferTrackingLinkDialog } from "@/components/publisher/cpa-offers/publisher-cpa-offer-tracking-link-dialog";
import { CpaOfferCard, CpaOfferCardGrid } from "@/components/cpa/cpa-offer-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  PublisherCpaOfferListResult,
  SerializedPublisherCpaOffer,
} from "@/services/cpa-offer.service";

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

function OfferAccessFooter({
  offer,
  requestingId,
  onRequestAccess,
  onOpenTracking,
}: {
  offer: SerializedPublisherCpaOffer;
  requestingId: string | null;
  onRequestAccess: (offerId: string) => void;
  onOpenTracking: (offer: SerializedPublisherCpaOffer) => void;
}) {
  if (offer.canPromote) {
    return (
      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => onOpenTracking(offer)}
      >
        <Link2 className="h-3.5 w-3.5" />
        Tracking Link
      </Button>
    );
  }

  if (offer.accessStatus === "PENDING") {
    return (
      <Button type="button" size="sm" variant="outline" className="w-full" disabled>
        Pending approval
      </Button>
    );
  }

  if (offer.accessStatus === "REJECTED") {
    return (
      <div className="w-full space-y-2">
        {offer.adminNote ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
            {offer.adminNote}
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="w-full gap-1.5"
          disabled={requestingId === offer.id}
          onClick={() => onRequestAccess(offer.id)}
        >
          Request Again
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      className="w-full gap-1.5"
      disabled={requestingId === offer.id}
      onClick={() => onRequestAccess(offer.id)}
    >
      <Lock className="h-3.5 w-3.5" />
      Request Access
    </Button>
  );
}

export function PublisherCpaOffersList() {
  const { data: session } = useSession();
  const publisherId = session?.user?.id ?? "";

  const [result, setResult] = useState<PublisherCpaOfferListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
  const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [trackingOffer, setTrackingOffer] = useState<SerializedPublisherCpaOffer | null>(null);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));
    if (applied.offerId.trim()) params.set("id", applied.offerId.trim());
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.category.trim()) params.set("category", applied.category.trim());

    const res = await fetch(`/api/v1/publisher/cpa-offers?${params}`);
    const body = await res.json().catch(() => ({}));
    setResult(body.data ?? null);
    setLoading(false);
  }, [page, applied]);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  async function requestAccess(offerId: string) {
    setRequestingId(offerId);
    try {
      const res = await fetch(`/api/v1/publisher/cpa-offers/${offerId}/request-access`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Unable to submit request");
      }
      toast.success("Access request submitted");
      await loadOffers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit request");
    } finally {
      setRequestingId(null);
    }
  }

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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">CPA Offers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse active CPA offers and copy your tracked affiliate links.
        </p>
      </div>

      <div className="space-y-3 rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
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

      <p className="text-sm text-muted-foreground">
        {total} offer{total === 1 ? "" : "s"} available to promote
      </p>

      {loading ? (
        <div className="h-64 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <Store className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No CPA offers available yet</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Check back later — new CPA offers appear here when published by the platform.
          </p>
        </div>
      ) : (
        <CpaOfferCardGrid>
          {items.map((offer) => (
            <CpaOfferCard
              key={offer.id}
              offer={offer}
              showVisibility
              footer={
                <div className="flex w-full justify-center">
                  <OfferAccessFooter
                    offer={offer}
                    requestingId={requestingId}
                    onRequestAccess={requestAccess}
                    onOpenTracking={setTrackingOffer}
                  />
                </div>
              }
            />
          ))}
        </CpaOfferCardGrid>
      )}

      {items.length > 0 ? (
        <div className="flex items-center justify-between rounded-[var(--radius-card,0.875rem)] border border-border bg-card px-4 py-3 shadow-[var(--shadow-card)]">
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
      ) : null}

      <PublisherCpaOfferTrackingLinkDialog
        open={Boolean(trackingOffer)}
        onOpenChange={(open) => {
          if (!open) setTrackingOffer(null);
        }}
        offer={trackingOffer}
        publisherId={publisherId}
      />
    </div>
  );
}
