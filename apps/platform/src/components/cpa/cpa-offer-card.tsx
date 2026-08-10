"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import { cn } from "@/lib/utils";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

function hasPreviewUrl(url: string) {
  return Boolean(url && url !== "#");
}

function StatusPill({ status }: { status: SerializedCpaOffer["status"] }) {
  const label =
    status === "ACTIVE" ? "Active" : status === "PAUSED" ? "Paused" : status === "ARCHIVED" ? "Archived" : status;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm",
        status === "ACTIVE" &&
          "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]",
        status === "PAUSED" &&
          "bg-[color-mix(in_srgb,var(--warning)_16%,white)] text-[var(--warning)]",
        status === "ARCHIVED" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

type CpaOfferCardProps = {
  offer: SerializedCpaOffer;
  /** Show revenue amount (admin). */
  showRevenue?: boolean;
  /** Show advertiser label (admin). */
  showAdvertiser?: boolean;
  footer?: ReactNode;
  className?: string;
};

export function CpaOfferCard({
  offer,
  showRevenue = false,
  showAdvertiser = false,
  footer,
  className,
}: CpaOfferCardProps) {
  const letter = (offer.name.trim()[0] || "?").toUpperCase();

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card",
        "shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {offer.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={offer.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-3xl font-bold text-white">
            {letter}
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="rounded-md bg-black/45 px-2 py-0.5 font-mono text-[11px] font-medium text-white backdrop-blur-sm">
            #{offer.id.slice(-6)}
          </span>
          <StatusPill status={offer.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {offer.name}
          </h3>
          {hasPreviewUrl(offer.previewUrl) ? (
            <a
              href={offer.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--theme-primary)] hover:underline"
            >
              Preview <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-[var(--theme-primary-soft)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
            {offer.payoutModel}
          </span>
          <span className="rounded-md bg-[color-mix(in_srgb,var(--theme-accent-purple,#713BFF)_14%,white)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-accent-purple,#713BFF)]">
            {offer.category}
          </span>
        </div>

        <CpaOfferGeoFlags country={offer.country} />

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-3">
          {showRevenue ? (
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Revenue
              </p>
              <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                ${offer.revenue}
              </p>
            </div>
          ) : null}
          <div className={showRevenue ? undefined : "col-span-2"}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Payout
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums text-[var(--theme-success)]">
              ${offer.payout}
            </p>
          </div>
        </div>

        {showAdvertiser ? (
          <p className="truncate text-xs text-muted-foreground">
            Advertiser · <span className="text-foreground">{offer.advertiserLabel}</span>
          </p>
        ) : null}
      </div>

      {footer ? (
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-4 py-3">
          {footer}
        </div>
      ) : null}
    </article>
  );
}

export function CpaOfferCardGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{children}</div>
  );
}
