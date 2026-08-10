"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  CpaCountryMultiSelect,
  countriesFromStorage,
  countriesToStorage,
} from "@/components/cpa/cpa-country-multi-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BuilderImageUpload } from "@/modules/page-builder/components/editor/builder-image-upload";
import { cn } from "@/lib/utils";
import { readApiErrorMessage } from "@/lib/errors";
import type {
  CpaPayoutModel,
  CpaPayoutType,
  CpaRevenueModel,
  SerializedCpaOffer,
} from "@/services/cpa-offer.service";

function previewUrlFromOffer(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";
  return !trimmed || trimmed === "#" ? "" : trimmed;
}

export type AdminCpaOfferFormValues = {
  name: string;
  advertiserLabel: string;
  category: string;
  countries: string[];
  trackingUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  revenueModel: CpaRevenueModel;
  payoutModel: CpaPayoutModel;
  payoutType: CpaPayoutType;
  revenue: string;
  payout: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

type AdminCpaOfferFormProps = {
  mode: "create" | "edit";
  offer?: SerializedCpaOffer | null;
};

const STATUS_OPTIONS: Array<{ value: AdminCpaOfferFormValues["status"]; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

const REVENUE_MODEL_OPTIONS: Array<{ value: CpaRevenueModel; label: string }> = [
  { value: "RPA", label: "RPA - Revenue Per Conversion" },
  { value: "RPS", label: "RPS - Revenue Per Sale" },
  { value: "RPC", label: "RPC - Revenue Per Click" },
  { value: "RPI", label: "RPI - Revenue Per Install" },
  { value: "RPL", label: "RPL - Revenue Per Lead" },
  { value: "RPM", label: "RPM - Revenue Per Impression" },
];

const PAYOUT_MODEL_OPTIONS: Array<{ value: CpaPayoutModel; label: string }> = [
  { value: "CPC", label: "CPC - Cost Per Click" },
  { value: "CPA", label: "CPA - Cost Per Conversion" },
  { value: "CPS", label: "CPS - Cost Per Sale" },
  { value: "CPI", label: "CPI - Cost Per Install" },
  { value: "CPL", label: "CPL - Cost Per Lead" },
  { value: "CPM", label: "Cost Per Impression" },
];

const PAYOUT_TYPE_OPTIONS: Array<{ value: CpaPayoutType; label: string }> = [
  { value: "FLAT", label: "Flat Fixed Payout" },
  { value: "PERCENT", label: "% based Payout" },
];

function FieldRow({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-border py-5 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
      <div className="sm:pt-2">
        <Label className="text-sm font-semibold text-foreground">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </Label>
        {help ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{help}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function AdminCpaOfferForm({ mode, offer }: AdminCpaOfferFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<AdminCpaOfferFormValues>(() => ({
    name: offer?.name ?? "",
    advertiserLabel: offer?.advertiserLabel || "Platform",
    category: offer?.category ?? "",
    countries: countriesFromStorage(offer?.country ?? ""),
    trackingUrl: offer?.trackingUrl ?? "",
    previewUrl: previewUrlFromOffer(offer?.previewUrl),
    thumbnailUrl: offer?.thumbnailUrl ?? "",
    revenueModel: offer?.revenueModel ?? "RPA",
    payoutModel: offer?.payoutModel ?? "CPA",
    payoutType: offer?.payoutType ?? "FLAT",
    revenue: offer?.revenue ?? "",
    payout: offer?.payout ?? "",
    status: offer?.status ?? "PAUSED",
  }));

  const amountSuffix = values.payoutType === "PERCENT" ? "%" : "$";

  const canSubmit = useMemo(() => {
    const revenue = Number(values.revenue);
    const payout = Number(values.payout);
    return (
      values.name.trim().length >= 2 &&
      values.advertiserLabel.trim().length >= 1 &&
      values.category.trim().length >= 1 &&
      values.trackingUrl.trim().length >= 1 &&
      Number.isFinite(revenue) &&
      revenue > 0 &&
      Number.isFinite(payout) &&
      payout > 0
    );
  }, [values]);

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        advertiserLabel: values.advertiserLabel.trim(),
        category: values.category.trim(),
        country: countriesToStorage(values.countries),
        trackingUrl: values.trackingUrl.trim(),
        previewUrl: values.previewUrl.trim() || "#",
        thumbnailUrl: values.thumbnailUrl.trim() || null,
        revenueModel: values.revenueModel,
        payoutModel: values.payoutModel,
        payoutType: values.payoutType,
        revenue: Number(values.revenue),
        payout: Number(values.payout),
        status: values.status,
      };

      const res =
        mode === "edit" && offer
          ? await fetch(`/api/v1/admin/cpa-offers/${offer.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch("/api/v1/admin/cpa-offers", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          readApiErrorMessage(
            body,
            mode === "edit" ? "Failed to update offer." : "Failed to create offer.",
            res.status,
          ),
        );
      }

      toast.success(mode === "edit" ? "Offer updated" : "Offer created");
      router.push("/admin/offer-network");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-28">
      <div>
        <Link
          href="/admin/offer-network"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Offers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {mode === "edit" ? "Edit Offer" : "Create Offer"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "edit"
            ? "Update marketplace offer details and payout."
            : "Add a CPA offer for the advertiser marketplace."}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card px-5 sm:px-6">
        <div className="border-b border-border py-4">
          <h2 className="text-base font-semibold text-foreground">Basic Details</h2>
          <p className="text-xs text-muted-foreground">Required offer identity and targeting.</p>
        </div>

        <FieldRow label="Title" required help="Enter the name or title of the offer.">
          <Input
            value={values.name}
            onChange={(e) => setValues((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Example: My US Offer"
          />
        </FieldRow>

        <FieldRow label="Advertiser" required help="Select or name the offer advertiser.">
          <Input
            value={values.advertiserLabel}
            onChange={(e) => setValues((prev) => ({ ...prev, advertiserLabel: e.target.value }))}
            placeholder="Cash Network"
          />
        </FieldRow>

        <FieldRow
          label="Offer Category"
          required
          help="Choose a category that fits your offer best."
        >
          <Input
            value={values.category}
            onChange={(e) => setValues((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Make Money"
          />
        </FieldRow>

        <FieldRow
          label="Select Countries"
          help="Select the countries where this offer can be promoted. If none are selected, the offer is available globally."
        >
          <CpaCountryMultiSelect
            value={values.countries}
            onChange={(countries) => setValues((prev) => ({ ...prev, countries }))}
          />
        </FieldRow>

        <FieldRow
          label="Offer Status"
          required
          help="Active offers appear in the advertiser marketplace."
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const selected = values.status === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, status: option.value }))}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 text-sm font-medium transition",
                    selected && option.value === "ACTIVE"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : selected
                        ? "border-slate-800 bg-slate-900 text-white"
                        : "border-border bg-card text-muted-foreground hover:border-border",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FieldRow>

        <FieldRow
          label="Icon / Image"
          help="Maximum size 1 MB. Upload an image or icon for the offer."
        >
          <BuilderImageUpload
            value={values.thumbnailUrl}
            onChange={(url) => setValues((prev) => ({ ...prev, thumbnailUrl: url }))}
            onClear={() => setValues((prev) => ({ ...prev, thumbnailUrl: "" }))}
            showUrlInput={false}
          />
        </FieldRow>

        <FieldRow
          label="Network Tracking URL"
          required
          help="Destination URL for the platform redirect. If the network supports click macros, include {click_id} or [click_id] (e.g. sub1=[click_id]) — Leadvix replaces these with the platform click id."
        >
          <Input
            value={values.trackingUrl}
            onChange={(e) => setValues((prev) => ({ ...prev, trackingUrl: e.target.value }))}
            placeholder="https://network.com/track?aff=..."
          />
        </FieldRow>

        <FieldRow
          label="Preview URL"
          help="Landing page or creatives preview shown to advertisers on the offer card."
        >
          <Input
            type="url"
            value={values.previewUrl}
            onChange={(e) => setValues((prev) => ({ ...prev, previewUrl: e.target.value }))}
            placeholder="https://example.com/landing-preview"
          />
        </FieldRow>
      </section>

      <section className="rounded-2xl border border-border bg-card px-5 sm:px-6">
        <div className="border-b border-border py-4">
          <h2 className="text-base font-semibold text-foreground">Payout</h2>
          <p className="text-xs text-muted-foreground">Revenue from advertiser and payout to affiliates.</p>
        </div>

        <div className="grid gap-0 sm:grid-cols-2 sm:gap-8">
          <FieldRow
            label="Revenue Model"
            required
            help="How you'll get paid by advertiser."
          >
            <Select
              value={values.revenueModel}
              onValueChange={(v) =>
                v && setValues((prev) => ({ ...prev, revenueModel: v as CpaRevenueModel }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <FieldRow
            label="Payout Model"
            required
            help="Payment model for affiliates."
          >
            <Select
              value={values.payoutModel}
              onValueChange={(v) =>
                v && setValues((prev) => ({ ...prev, payoutModel: v as CpaPayoutModel }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        <FieldRow
          label="Payout Type"
          required
          help="Choose how affiliates will be paid: fixed amount or percentage of sale."
        >
          <Select
            value={values.payoutType}
            onValueChange={(v) =>
              v && setValues((prev) => ({ ...prev, payoutType: v as CpaPayoutType }))
            }
          >
            <SelectTrigger className="max-w-md bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYOUT_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <div className="grid gap-0 sm:grid-cols-2 sm:gap-8">
          <FieldRow
            label={`Revenue (${amountSuffix})`}
            required
            help="Enter the amount you will be paid by the advertiser."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.revenue}
              onChange={(e) => {
                const revenue = e.target.value;
                setValues((prev) => ({
                  ...prev,
                  revenue,
                  payout: prev.payout || revenue,
                }));
              }}
              placeholder="160.00"
            />
          </FieldRow>

          <FieldRow
            label={`Payout (${amountSuffix})`}
            required
            help="Set the payout amount for affiliates."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={values.payout}
              onChange={(e) => setValues((prev) => ({ ...prev, payout: e.target.value }))}
              placeholder="120.00"
            />
          </FieldRow>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 px-4 py-3">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => router.push("/admin/offer-network")}
          >
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || saving} onClick={() => void handleSubmit()}>
            {saving ? "Saving…" : mode === "edit" ? "Save changes" : "Create offer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
