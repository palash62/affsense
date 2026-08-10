"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft, Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { buildCpaOfferTrackingUrl } from "@cpl/shared";
import { CpaOfferTrackingLinkDialog } from "@/components/advertiser/cpa-offer-tracking-link-dialog";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import { CpaOfferThumb } from "@/components/cpa/cpa-offer-thumb";
import { RoleHero } from "@/components/layout/role-hero";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

function CopyUrlField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={value}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 font-mono text-xs text-foreground"
        />
        <Button
          type="button"
          onClick={copy}
          className="h-10 shrink-0 gap-2 rounded-lg bg-[var(--theme-primary)] px-4 hover:opacity-90"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function AdvertiserCpaOfferDetail({ offerId }: { offerId: string }) {
  const { data: session } = useSession();
  const advertiserId = session?.user?.id ?? "";
  const [offer, setOffer] = useState<SerializedCpaOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [trackingOpen, setTrackingOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/v1/advertiser/cpa-offers/${offerId}`);
      const body = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(body?.error?.message ?? "Offer not found");
        setOffer(null);
        setLoading(false);
        return;
      }
      setOffer(body.data ?? null);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  if (loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading offer…</p>;
  }

  if (error || !offer) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">{error || "Offer not found"}</p>
        <Link
          href="/advertiser/cpa-offers"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex")}
        >
          Back to marketplace
        </Link>
      </div>
    );
  }

  const platformTrackingUrl = buildCpaOfferTrackingUrl(offer.id, {
    advertiserId: advertiserId || undefined,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/advertiser/cpa-offers"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Offer Marketplace
        </Link>
        <div className="flex flex-wrap items-start gap-4">
          <CpaOfferThumb name={offer.name} thumbnailUrl={offer.thumbnailUrl} />
          <div className="min-w-0 flex-1">
            <RoleHero
              eyebrow="CPA Offer"
              title={offer.name}
              description={`${offer.network} · ${offer.category}`}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-100 px-3 py-1 text-sm text-emerald-800 hover:bg-emerald-100">
                ${offer.payout} payout
              </Badge>
              <CpaOfferGeoFlags country={offer.country} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setTrackingOpen(true)}
              >
                <Link2 className="h-3.5 w-3.5" />
                Tracking Link
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Offer details</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Advertiser</dt>
              <dd className="font-medium text-foreground">{offer.advertiserLabel}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Network</dt>
              <dd className="font-medium text-foreground">{offer.network}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium text-foreground">{offer.category}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Geo</dt>
              <dd className="font-medium text-foreground">{offer.country}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-border pb-2">
              <dt className="text-muted-foreground">Payout</dt>
              <dd className="font-mono font-medium text-foreground">${offer.payout}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                  {offer.status}
                </Badge>
              </dd>
            </div>
          </dl>
          <a
            href={offer.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--theme-primary)] hover:underline"
          >
            Open preview <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </section>

        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Tracking</h2>
          <CopyUrlField label="Leadvix tracking URL" value={platformTrackingUrl} />
          <p className="text-xs text-muted-foreground">
            Use the Leadvix tracking URL in your ads (not the raw network URL below). Networks
            fire conversions to the platform Global Postback URL using the click id injected on
            redirect — include {"{click_id}"} or {"[click_id]"} in the offer&apos;s network URL
            when configuring the offer in admin.
          </p>
        </section>
      </div>

      <CpaOfferTrackingLinkDialog
        open={trackingOpen}
        onOpenChange={setTrackingOpen}
        offer={offer}
        advertiserId={advertiserId}
      />
    </div>
  );
}
