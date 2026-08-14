"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Send, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  CpaCountryMultiSelect,
  countriesFromStorage,
  countriesToStorage,
} from "@/components/cpa/cpa-country-multi-select";
import { BuilderImageUpload } from "@/modules/page-builder/components/editor/builder-image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { readApiErrorMessage } from "@/lib/errors";
import type { CpaOfferDetails, CpaTrackingMethod } from "@/lib/cpa-offer-details";
import type { CpaPayoutModel, SerializedCpaOffer } from "@/services/cpa-offer.service";

type EditorRole = "ADMIN" | "ADVERTISER";

type CpaOfferEditorProps = {
  role: EditorRole;
  mode?: "create" | "edit";
  offer?: SerializedCpaOffer | null;
  advertiserLabelDefault?: string;
};

type UrlParam = { key: string; value: string };

type EditorValues = {
  name: string;
  advertiserLabel: string;
  category: string;
  offerType: string;
  description: string;
  thumbnailUrl: string;
  payout: string;
  payoutModel: CpaPayoutModel;
  approvalTime: string;
  cookieDuration: string;
  trackingUrl: string;
  statusActive: boolean;
  countries: string[];
  disallowedCountries: string[];
  allowedTrafficSources: string[];
  disallowedTrafficSources: string[];
  devices: string;
  os: string;
  trackingMethod: CpaTrackingMethod;
  postbackUrl: string;
  urlParams: UrlParam[];
  additionalParams: string;
  creatives: string[];
  resourceLinks: string[];
};

const CATEGORY_OPTIONS = [
  "Make Money",
  "Finance",
  "Insurance",
  "Health",
  "Dating",
  "E-commerce",
  "Software",
  "Gaming",
  "Education",
  "Nutra",
];

const OFFER_TYPE_OPTIONS = [
  { value: "CPA", label: "CPA — Cost Per Action" },
  { value: "CPL", label: "CPL — Cost Per Lead" },
  { value: "CPI", label: "CPI — Cost Per Install" },
  { value: "CPS", label: "CPS — Cost Per Sale" },
  { value: "CPC", label: "CPC — Cost Per Click" },
];

const CONVERSION_TYPE_OPTIONS: Array<{ value: CpaPayoutModel; label: string }> = [
  { value: "CPA", label: "CPA — Cost Per Conversion" },
  { value: "CPL", label: "CPL — Cost Per Lead" },
  { value: "CPS", label: "CPS — Cost Per Sale" },
  { value: "CPI", label: "CPI — Cost Per Install" },
  { value: "CPC", label: "CPC — Cost Per Click" },
  { value: "CPM", label: "CPM — Cost Per Impression" },
];

const APPROVAL_TIME_OPTIONS = ["Instant", "24 hours", "48 hours", "7 days"];
const COOKIE_DURATION_OPTIONS = ["1 day", "7 days", "30 days", "90 days"];
const TRAFFIC_SOURCE_OPTIONS = [
  "Social",
  "Search",
  "Native",
  "Email",
  "Display",
  "Push",
  "Pop",
  "Incentive",
];
const DEVICE_OPTIONS = ["All Devices", "Desktop", "Mobile", "Tablet"];
const OS_OPTIONS = ["All OS", "Windows", "macOS", "Android", "iOS", "Linux"];

const AVAILABLE_MACROS = [
  { token: "{click_id}", description: "Unique click identifier" },
  { token: "{affiliate_id}", description: "Publisher / affiliate ID" },
  { token: "{offer_id}", description: "Offer ID" },
  { token: "{payout}", description: "Payout amount" },
  { token: "{sub_id}", description: "Sub ID / campaign token" },
  { token: "{source}", description: "Traffic source" },
];

const REVENUE_FROM_PAYOUT: Record<CpaPayoutModel, "RPA" | "RPS" | "RPC" | "RPI" | "RPL" | "RPM"> = {
  CPA: "RPA",
  CPS: "RPS",
  CPC: "RPC",
  CPI: "RPI",
  CPL: "RPL",
  CPM: "RPM",
};

function conversionLabel(model: CpaPayoutModel) {
  return CONVERSION_TYPE_OPTIONS.find((opt) => opt.value === model)?.label ?? model;
}

function formatMoney(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  return `$${amount.toFixed(2)}`;
}

function copyText(value: string, success: string) {
  void navigator.clipboard.writeText(value).then(
    () => toast.success(success),
    () => toast.error("Unable to copy"),
  );
}

function ChipMultiSelect({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(selected ? value.filter((item) => item !== option) : [...value, option])
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                selected
                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                  : "border-border bg-card text-muted-foreground hover:border-[var(--theme-primary)]/40",
              )}
            >
              {option}
            </button>
          );
        })}
      </div>
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      ) : null}
    </div>
  );
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--theme-primary)] text-xs font-semibold text-white">
          {step}
        </span>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      </div>
      <div className="grid gap-4 px-5 py-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function valuesFromOffer(
  offer: SerializedCpaOffer | null | undefined,
  advertiserLabelDefault: string,
): EditorValues {
  const details = offer?.details ?? {};
  return {
    name: offer?.name ?? "",
    advertiserLabel: offer?.advertiserLabel || advertiserLabelDefault,
    category: offer?.category ?? "",
    offerType: details.offerType || offer?.payoutModel || "CPA",
    description: offer?.description ?? "",
    thumbnailUrl: offer?.thumbnailUrl ?? "",
    payout: offer?.payout ?? "",
    payoutModel: offer?.payoutModel ?? "CPA",
    approvalTime: details.approvalTime || "24 hours",
    cookieDuration: details.cookieDuration || "30 days",
    trackingUrl: offer?.trackingUrl ?? "",
    statusActive: offer?.status === "ACTIVE",
    countries: countriesFromStorage(offer?.country ?? ""),
    disallowedCountries: details.disallowedCountries ?? [],
    allowedTrafficSources: details.allowedTrafficSources ?? [],
    disallowedTrafficSources: details.disallowedTrafficSources ?? [],
    devices: details.devices || "All Devices",
    os: details.os || "All OS",
    trackingMethod: details.trackingMethod ?? "POSTBACK",
    postbackUrl: details.postbackUrl ?? "",
    urlParams:
      details.urlParams && details.urlParams.length > 0
        ? details.urlParams
        : [
            { key: "click_id", value: "{click_id}" },
            { key: "affiliate_id", value: "{affiliate_id}" },
          ],
    additionalParams: details.additionalParams ?? "",
    creatives: details.creatives ?? [""],
    resourceLinks: details.resourceLinks ?? [""],
  };
}

function buildDetails(values: EditorValues, publishRequested: boolean): CpaOfferDetails {
  return {
    offerType: values.offerType,
    approvalTime: values.approvalTime,
    cookieDuration: values.cookieDuration,
    trackingMethod: values.trackingMethod,
    postbackUrl: values.postbackUrl.trim() || undefined,
    urlParams: values.urlParams.filter((row) => row.key.trim() || row.value.trim()),
    additionalParams: values.additionalParams.trim() || undefined,
    disallowedCountries: values.disallowedCountries,
    allowedTrafficSources: values.allowedTrafficSources,
    disallowedTrafficSources: values.disallowedTrafficSources,
    devices: values.devices,
    os: values.os,
    creatives: values.creatives.map((item) => item.trim()).filter(Boolean),
    resourceLinks: values.resourceLinks.map((item) => item.trim()).filter(Boolean),
    publishRequested,
  };
}

export function CpaOfferEditor({
  role,
  mode = "create",
  offer,
  advertiserLabelDefault = "Platform",
}: CpaOfferEditorProps) {
  const router = useRouter();
  const cancelHref = role === "ADMIN" ? "/admin/offer-network" : "/advertiser/cpa-offers";
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [values, setValues] = useState<EditorValues>(() =>
    valuesFromOffer(offer, advertiserLabelDefault),
  );

  const payoutAmount = Number(values.payout);
  const canSubmit = useMemo(
    () =>
      values.name.trim().length >= 2 &&
      values.category.trim().length >= 1 &&
      values.trackingUrl.trim().length >= 1 &&
      Number.isFinite(payoutAmount) &&
      payoutAmount > 0 &&
      (role === "ADVERTISER" || values.advertiserLabel.trim().length >= 1),
    [values, payoutAmount, role],
  );

  const trackingPreview = useMemo(() => {
    const base = values.trackingUrl.trim() || "https://your-offer-url.com";
    const params = values.urlParams.filter((row) => row.key.trim());
    if (!params.length) return base;
    const query = params
      .map((row) => `${encodeURIComponent(row.key.trim())}=${encodeURIComponent(row.value.trim())}`)
      .join("&");
    return `${base}${base.includes("?") ? "&" : "?"}${query}`;
  }, [values.trackingUrl, values.urlParams]);

  const statusLabel =
    role === "ADVERTISER"
      ? values.statusActive
        ? "Pending review"
        : "Draft"
      : values.statusActive
        ? "Active"
        : "Draft";

  function patch(next: Partial<EditorValues>) {
    setValues((prev) => ({ ...prev, ...next }));
  }

  function buildPayload(publish: boolean) {
    const payout = Number(values.payout);
    const publishRequested = role === "ADVERTISER" && publish;
    const status =
      role === "ADMIN" ? (publish ? "ACTIVE" : "PAUSED") : "PAUSED";
    return {
      name: values.name.trim(),
      advertiserLabel: values.advertiserLabel.trim() || advertiserLabelDefault,
      category: values.category.trim(),
      country: countriesToStorage(values.countries),
      trackingUrl: values.trackingUrl.trim(),
      previewUrl: values.trackingUrl.trim() || "#",
      thumbnailUrl: values.thumbnailUrl.trim() || null,
      description: values.description.trim() || null,
      details: buildDetails(values, publishRequested),
      payoutModel: values.payoutModel,
      revenueModel: REVENUE_FROM_PAYOUT[values.payoutModel],
      payoutType: "FLAT" as const,
      revenue: payout,
      payout,
      status,
    };
  }

  async function handleSave(publish: boolean) {
    if (!canSubmit || saving) return;
    setSaving(publish ? "publish" : "draft");
    try {
      const payload = buildPayload(publish);
      const res =
        mode === "edit" && offer
          ? await fetch(
              role === "ADMIN"
                ? `/api/v1/admin/cpa-offers/${offer.id}`
                : `/api/v1/advertiser/cpa-offers/${offer.id}`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            )
          : await fetch(
              role === "ADMIN" ? "/api/v1/admin/cpa-offers" : "/api/v1/advertiser/cpa-offers",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              },
            );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Unable to save offer", res.status));
      }
      if (role === "ADVERTISER" && publish) {
        toast.success("Offer submitted for admin review");
      } else if (publish) {
        toast.success(mode === "edit" ? "Offer published" : "Offer created and published");
      } else {
        toast.success(mode === "edit" ? "Draft saved" : "Draft created");
      }
      router.push(cancelHref);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save offer");
    } finally {
      setSaving(null);
    }
  }

  function testTrackingUrl() {
    const url = trackingPreview.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      toast.error("Enter a valid offer URL first");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-5 pb-24">
      {role === "ADVERTISER" ? (
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Add New CPA Offer</h1>
          <p className="mt-1 text-sm text-muted-foreground">CPA Offers &gt; Add New CPA Offer</p>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <SectionCard step={1} title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Offer Name" required>
                <Input
                  className="h-10 w-full"
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Summer Insurance Leads"
                />
              </Field>
              <Field label="Offer Category" required>
                <Select
                  value={values.category || undefined}
                  onValueChange={(value) => value && patch({ category: value })}
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Offer Type">
                <Select
                  value={values.offerType}
                  onValueChange={(value) => value && patch({ offerType: value })}
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {role === "ADMIN" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Advertiser" required className="sm:col-span-1">
                  <Input
                    className="h-10 w-full"
                    value={values.advertiserLabel}
                    onChange={(e) => patch({ advertiserLabel: e.target.value })}
                    placeholder="Platform"
                  />
                </Field>
              </div>
            ) : null}
            <Field label="Offer Description" className="col-span-full">
              <Textarea
                value={values.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Describe the offer, payout terms, and who it is for."
                className="min-h-28 w-full"
              />
            </Field>
            <Field
              label="Offer Preview Image"
              hint="Recommended size 1200x628px."
              className="col-span-full"
            >
              <BuilderImageUpload
                value={values.thumbnailUrl}
                onChange={(url) => patch({ thumbnailUrl: url })}
                onClear={() => patch({ thumbnailUrl: "" })}
                showUrlInput={false}
              />
            </Field>
          </SectionCard>

          <SectionCard step={2} title="Offer Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Payout Amount (USD)" required>
                <Input
                  className="h-10 w-full"
                  type="number"
                  min="0"
                  step="0.01"
                  value={values.payout}
                  onChange={(e) => patch({ payout: e.target.value })}
                  placeholder="25.00"
                />
              </Field>
              <Field label="Conversion Type">
                <Select
                  value={values.payoutModel}
                  onValueChange={(value) =>
                    value && patch({ payoutModel: value as CpaPayoutModel })
                  }
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVERSION_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Approval Time">
                <Select
                  value={values.approvalTime}
                  onValueChange={(value) => value && patch({ approvalTime: value })}
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVAL_TIME_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cookie Duration">
                <Select
                  value={values.cookieDuration}
                  onValueChange={(value) => value && patch({ cookieDuration: value })}
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COOKIE_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Offer URL / Landing Page" required className="lg:col-span-2">
                <Input
                  className="h-10 w-full"
                  value={values.trackingUrl}
                  onChange={(e) => patch({ trackingUrl: e.target.value })}
                  placeholder="https://example.com/offer"
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Offer Status</p>
                <p className="text-xs text-muted-foreground">
                  {role === "ADVERTISER"
                    ? "Advertiser offers stay paused until an admin publishes them."
                    : "Active offers appear in the marketplace."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={values.statusActive}
                onClick={() => patch({ statusActive: !values.statusActive })}
                className={cn(
                  "relative h-7 w-12 rounded-full transition",
                  values.statusActive ? "bg-[var(--theme-primary)]" : "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition",
                    values.statusActive ? "left-[22px]" : "left-0.5",
                  )}
                />
              </button>
            </div>
          </SectionCard>

          <SectionCard step={3} title="Targeting & Restrictions">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Allowed Countries">
                <CpaCountryMultiSelect
                  value={values.countries}
                  onChange={(countries) => patch({ countries })}
                />
              </Field>
              <Field label="Disallowed Countries (Optional)">
                <CpaCountryMultiSelect
                  value={values.disallowedCountries}
                  onChange={(disallowedCountries) => patch({ disallowedCountries })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Allowed Traffic Sources">
                <ChipMultiSelect
                  options={TRAFFIC_SOURCE_OPTIONS}
                  value={values.allowedTrafficSources}
                  onChange={(allowedTrafficSources) => patch({ allowedTrafficSources })}
                  placeholder="Leave empty to allow all sources."
                />
              </Field>
              <Field label="Disallowed Traffic Sources (Optional)">
                <ChipMultiSelect
                  options={TRAFFIC_SOURCE_OPTIONS}
                  value={values.disallowedTrafficSources}
                  onChange={(disallowedTrafficSources) => patch({ disallowedTrafficSources })}
                  placeholder="None blocked."
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Device Targeting">
                <Select
                  value={values.devices}
                  onValueChange={(value) => value && patch({ devices: value })}
                >
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="OS Targeting">
                <Select value={values.os} onValueChange={(value) => value && patch({ os: value })}>
                  <SelectTrigger className="h-10 w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionCard>

          <SectionCard step={4} title="Tracking & Integration">
            <Field label="Tracking Method">
              <div className="flex flex-wrap gap-2">
                {(["POSTBACK", "PIXEL"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => patch({ trackingMethod: method })}
                    className={cn(
                      "rounded-lg border px-3.5 py-2 text-sm font-medium transition",
                      values.trackingMethod === method
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                        : "border-border text-muted-foreground hover:border-[var(--theme-primary)]/40",
                    )}
                  >
                    {method === "POSTBACK" ? "Postback URL" : "Pixel Tracking"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={values.trackingMethod === "PIXEL" ? "Pixel URL" : "Postback URL"}>
              <Input
                className="h-10 w-full"
                value={values.postbackUrl}
                onChange={(e) => patch({ postbackUrl: e.target.value })}
                placeholder="https://your-postback-endpoint.com"
              />
            </Field>
            <Field label="URL Parameters / Macros">
              <div className="space-y-2">
                {values.urlParams.map((row, index) => (
                  <div key={`${index}-${row.key}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <Input
                      className="h-10 w-full min-w-0"
                      value={row.key}
                      onChange={(e) => {
                        const urlParams = [...values.urlParams];
                        urlParams[index] = { ...row, key: e.target.value };
                        patch({ urlParams });
                      }}
                      placeholder="click_id"
                    />
                    <Input
                      className="h-10 w-full min-w-0"
                      value={row.value}
                      onChange={(e) => {
                        const urlParams = [...values.urlParams];
                        urlParams[index] = { ...row, value: e.target.value };
                        patch({ urlParams });
                      }}
                      placeholder="{click_id}"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        patch({ urlParams: values.urlParams.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-1"
                  onClick={() => patch({ urlParams: [...values.urlParams, { key: "", value: "" }] })}
                >
                  <Plus className="h-4 w-4" />
                  Add Parameter
                </Button>
              </div>
            </Field>
            <Field label="Additional Parameters (Optional)">
              <Input
                className="h-10 w-full"
                value={values.additionalParams}
                onChange={(e) => patch({ additionalParams: e.target.value })}
                placeholder="utm_source=affsense"
              />
            </Field>
            <div>
              <Button type="button" variant="outline" onClick={testTrackingUrl}>
                Test Tracking URL
              </Button>
            </div>
          </SectionCard>

          <SectionCard step={5} title="Creatives & Marketing Materials (Optional)">
            <Field label="Upload Creatives" hint="Paste image URLs or upload extra creatives.">
              <div className="space-y-2">
                {values.creatives.map((url, index) => (
                  <div key={`creative-${index}`} className="flex gap-2">
                    <Input
                      className="h-10 w-full min-w-0"
                      value={url}
                      onChange={(e) => {
                        const creatives = [...values.creatives];
                        creatives[index] = e.target.value;
                        patch({ creatives });
                      }}
                      placeholder="https://cdn.example.com/banner.jpg"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        patch({ creatives: values.creatives.filter((_, i) => i !== index) })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-1"
                  onClick={() => patch({ creatives: [...values.creatives, ""] })}
                >
                  <Upload className="h-4 w-4" />
                  Add Creative URL
                </Button>
              </div>
            </Field>
            <Field label="Offer Resources">
              <div className="space-y-2">
                {values.resourceLinks.map((url, index) => (
                  <div key={`resource-${index}`} className="flex gap-2">
                    <Input
                      className="h-10 w-full min-w-0"
                      value={url}
                      onChange={(e) => {
                        const resourceLinks = [...values.resourceLinks];
                        resourceLinks[index] = e.target.value;
                        patch({ resourceLinks });
                      }}
                      placeholder="https://example.com/offer-guide.pdf"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() =>
                        patch({
                          resourceLinks: values.resourceLinks.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-1"
                  onClick={() => patch({ resourceLinks: [...values.resourceLinks, ""] })}
                >
                  <Plus className="h-4 w-4" />
                  Add Resource Link
                </Button>
              </div>
            </Field>
          </SectionCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold text-foreground">Offer Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Offer Name</dt>
                <dd className="truncate font-medium">{values.name.trim() || "Not Set"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Payout Amount</dt>
                <dd className="font-medium">{formatMoney(values.payout)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Conversion Type</dt>
                <dd className="truncate font-medium">{conversionLabel(values.payoutModel)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      statusLabel === "Active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {statusLabel}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Tracking Link Preview</h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => copyText(trackingPreview, "Tracking link copied")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 break-all rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              {trackingPreview}
            </p>
          </div>

          <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
            <h3 className="text-sm font-semibold text-foreground">Available Macros</h3>
            <ul className="mt-3 space-y-2">
              {AVAILABLE_MACROS.map((macro) => (
                <li key={macro.token} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[var(--theme-primary)]">
                      {macro.token}
                    </p>
                    <p className="text-xs text-muted-foreground">{macro.description}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => copyText(macro.token, "Macro copied")}
                  >
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-4 py-3">
          <Button type="button" variant="outline" disabled={Boolean(saving)} onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canSubmit || Boolean(saving)}
            onClick={() => void handleSave(false)}
          >
            {saving === "draft" ? "Saving…" : "Save as Draft"}
          </Button>
          <Button
            type="button"
            className="gap-1.5"
            disabled={!canSubmit || Boolean(saving)}
            onClick={() => void handleSave(true)}
          >
            <Send className="h-4 w-4" />
            {saving === "publish"
              ? "Publishing…"
              : role === "ADVERTISER"
                ? "Submit for Review"
                : "Save & Publish Offer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
