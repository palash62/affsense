"use client";

import { ExternalLink } from "lucide-react";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import { formatCurrency } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

export type OfferWallItem = {
  id: string;
  name: string;
  payout: string;
  type: string | null;
  country: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  trackingUrl: string;
};

export function offerWallEarnClassName(featured?: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-md text-white transition hover:brightness-110",
    featured ? "bg-[var(--theme-primary)]" : "bg-[var(--theme-success)]",
  );
}

export function OfferWallEarnLink({
  href,
  payout,
  featured,
  layout = "stack",
  stopPropagation,
  className,
}: {
  href: string;
  payout: number;
  featured?: boolean;
  layout?: "stack" | "bar";
  stopPropagation?: boolean;
  className?: string;
}) {
  const label = formatCurrency(payout);
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        offerWallEarnClassName(featured),
        layout === "stack"
          ? "min-h-11 w-full flex-col px-3 py-2 text-center"
          : "h-11 w-full gap-2 px-4 text-sm font-semibold",
        className,
      )}
    >
      {layout === "stack" ? (
        <>
          <span className="text-[11px] font-medium leading-none opacity-90">Earn</span>
          <span className="mt-0.5 text-sm font-bold tabular-nums leading-tight">{label}</span>
        </>
      ) : (
        <>
          Earn {label}
          <ExternalLink className="h-4 w-4" />
        </>
      )}
    </a>
  );
}

export function OfferWallRow({
  offer,
  featured,
  onSelect,
}: {
  offer: OfferWallItem;
  featured?: boolean;
  onSelect: () => void;
}) {
  const payout = Number(offer.payout) || 0;
  const letter = (offer.name.trim()[0] || "?").toUpperCase();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col gap-3 border-b border-border px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:px-5",
        "transition-colors hover:bg-muted/50",
        featured && "bg-[color-mix(in_srgb,var(--theme-primary)_4%,white)]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
          {offer.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={offer.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-lg font-bold text-white">
              {letter}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
              {offer.name}
            </h3>
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold",
                offer.type
                  ? "bg-[color-mix(in_srgb,var(--warning)_18%,white)] text-[var(--warning)]"
                  : "bg-[color-mix(in_srgb,var(--theme-primary)_12%,white)] text-[var(--theme-primary)]",
              )}
            >
              {offer.type || "Offer"}
            </span>
          </div>
          <CpaOfferGeoFlags country={offer.country ?? ""} maxVisible={4} />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-stretch sm:w-[132px] sm:items-center">
        {offer.trackingUrl ? (
          <OfferWallEarnLink
            href={offer.trackingUrl}
            payout={payout}
            featured={featured}
            stopPropagation
          />
        ) : (
          <span className="inline-flex min-h-11 w-full flex-col items-center justify-center rounded-md bg-muted px-3 py-2 text-center text-muted-foreground">
            <span className="text-[11px] font-medium leading-none">Earn</span>
            <span className="mt-0.5 text-sm font-bold tabular-nums leading-tight">
              {formatCurrency(payout)}
            </span>
          </span>
        )}
        {featured ? (
          <p className="mt-1 text-center text-[11px] font-semibold text-[var(--theme-primary)]">
            Top offer
          </p>
        ) : null}
      </div>
    </article>
  );
}
