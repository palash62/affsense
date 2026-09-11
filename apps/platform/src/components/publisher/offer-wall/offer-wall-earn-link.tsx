"use client";

import { useState, type MouseEvent } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
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
  offer,
  payout,
  featured,
  layout = "stack",
  stopPropagation,
  className,
  subId,
  src,
  trackClicks = true,
}: {
  offer: Pick<OfferWallItem, "id" | "name" | "trackingUrl">;
  payout: number;
  featured?: boolean;
  layout?: "stack" | "bar";
  stopPropagation?: boolean;
  className?: string;
  subId?: string;
  src?: string;
  /** When false (admin preview), open the network URL without logging a click. */
  trackClicks?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const label = formatCurrency(payout);

  async function openTracked(e: MouseEvent) {
    if (stopPropagation) e.stopPropagation();
    e.preventDefault();
    if (!offer.trackingUrl || busy) return;

    if (!trackClicks) {
      window.open(offer.trackingUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/v1/publisher/offer-wall/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          offerName: offer.name,
          trackingUrl: offer.trackingUrl,
          subId: subId || undefined,
          src: src || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Could not open offer");
      }
      const url = (body.data?.trackingUrl as string) || offer.trackingUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open offer");
      window.open(offer.trackingUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <a
      href={offer.trackingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => void openTracked(e)}
      aria-busy={busy}
      className={cn(
        offerWallEarnClassName(featured),
        layout === "stack"
          ? "min-h-11 w-full flex-col px-3 py-2 text-center"
          : "h-11 w-full gap-2 px-4 text-sm font-semibold",
        busy && "opacity-70",
        className,
      )}
    >
      {layout === "stack" ? (
        <>
          <span className="text-[11px] font-medium leading-none opacity-90">
            {busy ? "Opening…" : "Earn"}
          </span>
          <span className="mt-0.5 text-sm font-bold tabular-nums leading-tight">{label}</span>
        </>
      ) : (
        <>
          {busy ? "Opening…" : `Earn ${label}`}
          <ExternalLink className="h-4 w-4" />
        </>
      )}
    </a>
  );
}
