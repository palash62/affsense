"use client";

import { useCallback } from "react";
import { buildCpaOfferTrackingUrl } from "@cpl/shared";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  AffiliateTrackingLinkCard,
  type AffiliateTrackingExtras,
} from "@/components/admin/affiliate-tracking-link-card";
import { PageHeader } from "@/components/layout/page-header";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import {
  CpaOfferTrackingInstructions,
  cpaOfferStatusBadgeClass,
  cpaOfferStatusLabel,
} from "@/components/cpa/cpa-offer-tracking-instructions";
import { formatCurrency } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

function hasPreviewUrl(url: string) {
  return Boolean(url && url !== "#");
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

function formatRate(amount: string, percent: boolean, model: string) {
  const value = percent ? `${amount}%` : formatCurrency(Number(amount));
  return `${value} · ${model}`;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

export function AdminCpaOfferDetailPage({
  offer,
}: {
  offer: SerializedCpaOffer;
}) {
  const letter = (offer.name.trim()[0] || "?").toUpperCase();
  const buildAffiliateUrl = useCallback(
    (publisherId: string, extras: AffiliateTrackingExtras) =>
      buildCpaOfferTrackingUrl(offer.id, {
        publisherId,
        src: extras.src,
        subId: extras.subId,
      }),
    [offer.id],
  );
  const percent = offer.payoutType === "PERCENT";
  const margin = Number(offer.revenue) - Number(offer.payout);
  const marginLabel = percent ? `${margin.toFixed(2)}%` : formatCurrency(margin);

  return (
    <div className="space-y-5">
      <PageHeader
        title={offer.name}
        description={`Offer #${offer.id.slice(-6)} · ${offer.network || "Network"}`}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Offer Network", href: "/admin/offer-network" },
          { label: offer.name },
        ]}
        badge={
          <Badge className={cpaOfferStatusBadgeClass(offer.status)}>
            {cpaOfferStatusLabel(offer.status)}
          </Badge>
        }
      >
        <ButtonLink
          href={`/admin/cpa-offers/${offer.id}/edit`}
          className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
        >
          <Pencil className="h-4 w-4" />
          Edit offer
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="relative aspect-[16/10] w-full bg-muted">
              {offer.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={offer.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-4xl font-bold text-white">
                  {letter}
                </div>
              )}
            </div>
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-md bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                  {offer.payoutModel}
                </span>
                <span className="rounded-md bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_14%,white)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-accent-purple,#713BFF)]">
                  {offer.category}
                </span>
                <span
                  className={
                    offer.visibility === "PRIVATE"
                      ? "rounded-md bg-[color-mix(in_srgb,var(--warning)_16%,white)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warning)]"
                      : "rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                  }
                >
                  {offer.visibility === "PRIVATE" ? "Private" : "Public"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <DetailRow label="Revenue">
                  <span className="font-mono tabular-nums">
                    {formatRate(offer.revenue, percent, offer.revenueModel)}
                  </span>
                </DetailRow>
                <DetailRow label="Payout">
                  <span className="font-mono tabular-nums text-[var(--theme-success)]">
                    {formatRate(offer.payout, percent, offer.payoutModel)}
                  </span>
                </DetailRow>
                <DetailRow label="Margin">
                  <span className="font-mono tabular-nums">{marginLabel}</span>
                </DetailRow>
                <DetailRow label="Network">{offer.network || "—"}</DetailRow>
              </div>

              <DetailRow label="Advertiser">
                {offer.ownerAdvertiserName || offer.advertiserLabel}
              </DetailRow>

              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Countries
                </p>
                <CpaOfferGeoFlags country={offer.country} maxVisible={12} />
              </div>

              {hasPreviewUrl(offer.previewUrl) ? (
                <a
                  href={offer.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--theme-primary)] hover:underline"
                >
                  Preview landing page <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-2 rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Offer tracking URL
            </p>
            <p className="break-all font-mono text-xs text-foreground">{offer.trackingUrl}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => void copyText(offer.trackingUrl, "Tracking URL")}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </Button>
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <AffiliateTrackingLinkCard
            buildUrl={buildAffiliateUrl}
            warning={
              offer.visibility === "PRIVATE"
                ? "This is a private offer. The link only works once the affiliate's access request is approved."
                : undefined
            }
          />
          <CpaOfferTrackingInstructions offer={offer} />
        </div>
      </div>
    </div>
  );
}
