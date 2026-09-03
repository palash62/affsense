"use client";

import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import { formatCurrency } from "@/components/admin/admin-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { OfferWallEarnLink, type OfferWallItem } from "./offer-wall-row";

export function OfferWallDetailSheet({
  offer,
  featured,
  open,
  onOpenChange,
}: {
  offer: OfferWallItem | null;
  featured?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const payout = Number(offer?.payout) || 0;
  const letter = (offer?.name.trim()[0] || "?").toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="pr-8 text-left">{offer?.name ?? "Offer details"}</SheetTitle>
          <SheetDescription className="sr-only">
            {offer ? `${offer.type || "Offer"} · ${formatCurrency(payout)}` : "Offer details"}
          </SheetDescription>
        </SheetHeader>

        {offer ? (
          <div className="flex flex-1 flex-col space-y-5 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                {offer.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={offer.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-xl font-bold text-white">
                    {letter}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
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
                <p
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    featured ? "text-[var(--theme-primary)]" : "text-[var(--theme-success)]",
                  )}
                >
                  {formatCurrency(payout)}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Countries</p>
              <CpaOfferGeoFlags country={offer.country ?? ""} maxVisible={6} />
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-foreground">Details</p>
              {offer.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {offer.description}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No details from the network.</p>
              )}
            </div>
          </div>
        ) : null}

        <SheetFooter className="sticky bottom-0 border-t border-border bg-popover">
          {offer?.trackingUrl ? (
            <OfferWallEarnLink
              href={offer.trackingUrl}
              payout={payout}
              featured={featured}
              layout="bar"
            />
          ) : (
            <span className="inline-flex h-11 w-full items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground">
              Earn {formatCurrency(payout)}
            </span>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
