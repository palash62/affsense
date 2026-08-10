"use client";

import { cn } from "@/lib/utils";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";
import { computeCommissionAmount, type DigitalProductFormValues } from "./mock-data";

export function OfferSummaryPanel({
  values,
  imagePreview,
}: {
  values: DigitalProductFormValues;
  imagePreview: string | null;
}) {
  const price = Number.parseFloat(values.price) || 0;
  const fePercent = Number.parseFloat(values.frontEndCommission) || 0;
  const upsellPercent = Number.parseFloat(values.upsellCommission) || 0;
  const referralPercent = Number.parseFloat(values.referralReward) || 0;

  return (
    <DashboardCard>
      <DashboardCardTitle>Offer Summary</DashboardCardTitle>
      <div className="mt-4 flex gap-3">
        {imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePreview}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-bold text-white">
            {values.name.slice(0, 1) || "A"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {values.name || "Untitled product"}
          </p>
          <span
            className={cn(
              "mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
              values.status === "Active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700",
            )}
          >
            {values.status}
          </span>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Category</dt>
          <dd className="font-medium text-foreground">{values.category || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium text-foreground">{values.productType || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Niche</dt>
          <dd className="font-medium text-foreground">{values.niche || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Vendor</dt>
          <dd className="truncate font-medium text-foreground">{values.vendor || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Price (FE)</p>
          <p className="font-semibold text-foreground">${price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Commission (FE)</p>
          <p className="font-semibold text-foreground">
            {fePercent}% ({computeCommissionAmount(price, fePercent)})
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Upsell Commission</p>
          <p className="font-semibold text-foreground">{upsellPercent}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Referral Reward</p>
          <p className="font-semibold text-foreground">{referralPercent}%</p>
        </div>
      </div>
    </DashboardCard>
  );
}
