"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import {
  CpaOfferTrackingInstructions,
  cpaOfferStatusBadgeClass,
  cpaOfferStatusLabel,
} from "@/components/cpa/cpa-offer-tracking-instructions";
import { PublisherCpaOfferTrackingLinkDialog } from "@/components/publisher/cpa-offers/publisher-cpa-offer-tracking-link-dialog";
import { formatCurrency } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SerializedPublisherCpaOffer } from "@/services/cpa-offer.service";

function hasPreviewUrl(url: string) {
  return Boolean(url && url !== "#");
}

export function PublisherCpaOfferDetailPage({
  offer,
  publisherId,
}: {
  offer: SerializedPublisherCpaOffer;
  publisherId: string;
}) {
  const router = useRouter();
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [localOffer, setLocalOffer] = useState(offer);

  const letter = (localOffer.name.trim()[0] || "?").toUpperCase();
  const payoutLabel =
    localOffer.payoutType === "PERCENT"
      ? `${localOffer.payout}% · ${localOffer.payoutModel}`
      : `${formatCurrency(Number(localOffer.payout))} · ${localOffer.payoutModel}`;

  async function requestAccess() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/v1/publisher/cpa-offers/${localOffer.id}/request-access`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Unable to submit request");
      }
      toast.success("Access request submitted");
      setLocalOffer((prev) => ({
        ...prev,
        accessStatus: "PENDING",
        canPromote: false,
        adminNote: null,
      }));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit request");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/publisher/cpa-offers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          CPA Offers
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{localOffer.name}</h1>
          <Badge className={cpaOfferStatusBadgeClass(localOffer.status)}>
            {cpaOfferStatusLabel(localOffer.status)}
          </Badge>
          {localOffer.visibility === "PRIVATE" ? (
            <Badge variant="secondary" className="bg-amber-50 text-amber-900 hover:bg-amber-50">
              Private
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">OFFER #{localOffer.id}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="relative aspect-[16/10] w-full bg-muted">
              {localOffer.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localOffer.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-4xl font-bold text-white">
                  {letter}
                </div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                  {localOffer.payoutModel}
                </span>
                <span className="rounded-md bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_14%,white)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-accent-purple,#713BFF)]">
                  {localOffer.category}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Payout
                </p>
                <p className="font-mono text-lg font-semibold tabular-nums text-[var(--theme-success)]">
                  {payoutLabel}
                </p>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Countries
                </p>
                <CpaOfferGeoFlags country={localOffer.country} maxVisible={12} />
              </div>
              {hasPreviewUrl(localOffer.previewUrl) ? (
                <a
                  href={localOffer.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--theme-primary)] hover:underline"
                >
                  Preview landing page <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            {localOffer.canPromote ? (
              <Button
                type="button"
                className="w-full gap-1.5"
                onClick={() => setTrackingOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Tracking Link
              </Button>
            ) : localOffer.accessStatus === "PENDING" ? (
              <Button type="button" variant="outline" className="w-full" disabled>
                Pending approval
              </Button>
            ) : localOffer.accessStatus === "REJECTED" ? (
              <div className="space-y-2">
                {localOffer.adminNote ? (
                  <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                    {localOffer.adminNote}
                  </p>
                ) : null}
                <Button
                  type="button"
                  className="w-full gap-1.5"
                  disabled={requesting}
                  onClick={() => void requestAccess()}
                >
                  Request Again
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                className="w-full gap-1.5"
                disabled={requesting}
                onClick={() => void requestAccess()}
              >
                <Lock className="h-3.5 w-3.5" />
                Request Access
              </Button>
            )}
          </div>
        </div>

        <CpaOfferTrackingInstructions offer={localOffer} />
      </div>

      <PublisherCpaOfferTrackingLinkDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        offer={localOffer}
        publisherId={publisherId}
      />
    </div>
  );
}
