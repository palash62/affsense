"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { CpaOfferGeoFlags } from "@/components/cpa/cpa-offer-geo-flags";
import { formatCurrency } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Badge
          key={item}
          variant="secondary"
          className="rounded-md bg-slate-100 font-medium text-slate-800 hover:bg-slate-100"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}

function LinkList({ urls }: { urls: string[] }) {
  return (
    <ul className="space-y-1.5">
      {urls.map((url) => (
        <li key={url}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 text-sm text-sky-700 underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{url}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function cpaOfferStatusBadgeClass(status: SerializedCpaOffer["status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
  if (status === "PAUSED") return "bg-amber-100 text-amber-900 hover:bg-amber-100";
  return "bg-muted text-muted-foreground hover:bg-muted";
}

export function cpaOfferStatusLabel(status: SerializedCpaOffer["status"]) {
  if (status === "ACTIVE") return "Active";
  if (status === "PAUSED") return "Paused";
  if (status === "ARCHIVED") return "Archived";
  return status;
}

/** Affiliate-facing offer instructions for tracking-link dialogs (no destination/postback URLs). */
export function CpaOfferTrackingInstructions({
  offer,
  className,
}: {
  offer: SerializedCpaOffer;
  className?: string;
}) {
  const details = offer.details ?? {};
  const description = offer.description?.trim() || null;
  const allowedTraffic = details.allowedTrafficSources ?? [];
  const disallowedTraffic = details.disallowedTrafficSources ?? [];
  const disallowedCountries = details.disallowedCountries ?? [];
  const devices = details.devices?.trim() || null;
  const os = details.os?.trim() || null;
  const approvalTime = details.approvalTime?.trim() || null;
  const cookieDuration = details.cookieDuration?.trim() || null;
  const offerType = details.offerType?.trim() || null;
  const creatives = details.creatives ?? [];
  const resourceLinks = details.resourceLinks ?? [];
  const previewUrl =
    offer.previewUrl?.trim() && offer.previewUrl.trim() !== "#"
      ? offer.previewUrl.trim()
      : null;

  const payoutLabel =
    offer.payoutType === "PERCENT"
      ? `${offer.payout}% · ${offer.payoutModel}`
      : `${formatCurrency(Number(offer.payout))} · ${offer.payoutModel}`;

  const hasAny =
    description ||
    offer.country ||
    disallowedCountries.length > 0 ||
    allowedTraffic.length > 0 ||
    disallowedTraffic.length > 0 ||
    devices ||
    os ||
    payoutLabel ||
    approvalTime ||
    cookieDuration ||
    offerType ||
    previewUrl ||
    creatives.length > 0 ||
    resourceLinks.length > 0;

  if (!hasAny) return null;

  return (
    <section
      className={cn("space-y-3 rounded-xl border border-border bg-card p-4", className)}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">Offer details</p>
        <p className="text-xs text-muted-foreground">
          Read targeting and traffic rules before promoting this offer.
        </p>
      </div>

      <dl className="space-y-3">
        {description ? (
          <DetailRow label="Description">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {description}
            </p>
          </DetailRow>
        ) : null}

        {offer.country ? (
          <DetailRow label="Countries">
            <CpaOfferGeoFlags country={offer.country} maxVisible={12} />
          </DetailRow>
        ) : null}

        {disallowedCountries.length > 0 ? (
          <DetailRow label="Disallowed countries">
            <ChipList items={disallowedCountries} />
          </DetailRow>
        ) : null}

        {allowedTraffic.length > 0 ? (
          <DetailRow label="Allowed traffic">
            <ChipList items={allowedTraffic} />
          </DetailRow>
        ) : null}

        {disallowedTraffic.length > 0 ? (
          <DetailRow label="Disallowed traffic">
            <ChipList items={disallowedTraffic} />
          </DetailRow>
        ) : null}

        {devices ? (
          <DetailRow label="Device">
            <span>{devices}</span>
          </DetailRow>
        ) : null}

        {os ? (
          <DetailRow label="OS">
            <span>{os}</span>
          </DetailRow>
        ) : null}

        <DetailRow label="Payout">
          <span className="font-semibold tabular-nums text-emerald-700">{payoutLabel}</span>
        </DetailRow>

        {offerType ? (
          <DetailRow label="Offer type">
            <span>{offerType}</span>
          </DetailRow>
        ) : null}

        {approvalTime ? (
          <DetailRow label="Approval">
            <span>{approvalTime}</span>
          </DetailRow>
        ) : null}

        {cookieDuration ? (
          <DetailRow label="Cookie">
            <span>{cookieDuration}</span>
          </DetailRow>
        ) : null}

        {previewUrl ? (
          <DetailRow label="Preview">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sky-700 underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open preview
            </a>
          </DetailRow>
        ) : null}

        {creatives.length > 0 ? (
          <DetailRow label="Creatives">
            <LinkList urls={creatives} />
          </DetailRow>
        ) : null}

        {resourceLinks.length > 0 ? (
          <DetailRow label="Resources">
            <LinkList urls={resourceLinks} />
          </DetailRow>
        ) : null}
      </dl>
    </section>
  );
}
