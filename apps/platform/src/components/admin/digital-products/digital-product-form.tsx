"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Info, Send, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import {
  DEFAULT_FORM_VALUES,
  DIGITAL_PRODUCT_NICHES,
  DIGITAL_PRODUCT_TYPES,
  SHORT_DESCRIPTION_MAX,
  AFFILIATE_TRACKING_SAMPLE_VALUE,
  buildAffiliateTrackingPreviewUrl,
  readImageDataUrl,
  type DigitalProductFormValues,
  type DigitalProductStatus,
} from "./digital-product-types";
import { OfferSummaryPanel } from "./offer-summary-panel";
import { WebhookStatusPanel } from "./webhook-status-panel";
import { PromoMaterialsPanel } from "./promo-materials-panel";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-sm font-bold text-[var(--theme-primary)]">
        {number}
      </span>
      <DashboardCardTitle className="text-lg">{title}</DashboardCardTitle>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-sm font-medium text-foreground">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </Label>
  );
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function DigitalProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const isEdit = Boolean(productId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<File | null>(null);
  const [values, setValues] = useState<DigitalProductFormValues>(DEFAULT_FORM_VALUES);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/v1/admin/digital-products/categories")
      .then((r) => r.json())
      .then((json) => {
        setCategories(
          (json.data ?? [])
            .filter((c: { status: string }) => c.status === "Active")
            .map((c: { name: string }) => c.name),
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!productId) return;
    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);
    fetch(`/api/v1/admin/digital-products/${productId}`, { signal: ac.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error?.message ?? "Not found");
        return json.data;
      })
      .then((data) => {
        if (ac.signal.aborted || !data) return;
        setValues({
          name: data.name ?? "",
          category: data.category ?? "",
          shortDescription: data.shortDescription ?? "",
          productType: data.productType ?? "Digital Download",
          niche: data.niche ?? "Productivity",
          status: data.status === "Active" ? "Active" : "Draft",
          featured: Boolean(data.featured),
          isNew: Boolean(data.isNew),
          salesPageUrl: data.salesPageUrl ?? "",
          affiliateTrackingParam: data.affiliateTrackingParam ?? "affsense_id",
          previewUrl: data.previewUrl ?? "",
          frontEndCommission: String(data.frontEndCommission ?? ""),
          upsellCommission:
            data.upsellCommission == null ? "" : String(data.upsellCommission),
          referralReward:
            data.referralReward == null ? "" : String(data.referralReward),
          price: String(data.price ?? ""),
          vendor: data.vendor ?? "",
          webhookSecret: "",
        });
        if (data.imageUrl) setImagePreview(data.imageUrl);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Could not load product";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [productId, loadKey]);

  const descriptionCount = values.shortDescription.length;

  const trackingPreviewUrl = useMemo(
    () =>
      buildAffiliateTrackingPreviewUrl(
        values.salesPageUrl,
        values.affiliateTrackingParam,
      ),
    [values.salesPageUrl, values.affiliateTrackingParam],
  );

  const trackingParamLabel =
    values.affiliateTrackingParam.trim() || "affsense_id";

  const canPublish = useMemo(
    () => values.name.trim().length >= 2 && values.salesPageUrl.trim().length >= 1,
    [values.name, values.salesPageUrl],
  );

  function patch(partial: Partial<DigitalProductFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    imageFileRef.current = file;
    const url = URL.createObjectURL(file);
    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }

  async function persistProduct(status: DigitalProductStatus, successMessage: string) {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: values.name,
        category: values.category,
        shortDescription: values.shortDescription,
        productType: values.productType,
        niche: values.niche,
        status,
        featured: values.featured,
        isNew: values.isNew,
        salesPageUrl: values.salesPageUrl,
        affiliateTrackingParam: values.affiliateTrackingParam,
        previewUrl: values.previewUrl,
        frontEndCommission: Number(values.frontEndCommission) || 0,
        upsellCommission: Number(values.upsellCommission) || 0,
        referralReward: Number(values.referralReward) || 0,
        price: Number(values.price) || 0,
        vendor: values.vendor,
      };
      if (imageFileRef.current) {
        payload.imageUrl = await readImageDataUrl(imageFileRef.current);
      }
      const res = await fetch(
        productId
          ? `/api/v1/admin/digital-products/${productId}`
          : "/api/v1/admin/digital-products",
        {
          method: productId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message ?? "save failed");
      }
      toast.success(successMessage);
      router.push("/admin/digital-products");
    } catch {
      toast.error("Could not save product");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveDraft() {
    if (values.name.trim().length < 2) {
      toast.error("Enter a product name to save a draft");
      return;
    }
    void persistProduct("Draft", "Draft saved");
  }

  function handlePublish() {
    if (!canPublish) {
      toast.error("Fill in product name and sales page URL");
      return;
    }
    void persistProduct("Active", isEdit ? "Offer updated" : "Offer published");
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-8 text-sm text-muted-foreground">
        Loading product...
      </div>
    );
  }

  if (isEdit && loadError) {
    return (
      <div className="space-y-4 rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-8">
        <p className="text-sm text-destructive">{loadError}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
            onClick={() => setLoadKey((k) => k + 1)}
          >
            Retry
          </Button>
          <ButtonLink
            href="/admin/digital-products"
            variant="outline"
            className="h-10 rounded-md border-border px-4"
          >
            Back to products
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <AdminBreadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Digital Products", href: "/admin/digital-products" },
          { label: isEdit ? "Edit" : "Add New" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          {/* 1. Basic Information */}
          <DashboardCard>
            <SectionHeader number={1} title="Basic Information" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel required>Product Name</FieldLabel>
                <Input
                  value={values.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="AI Prompt Vault"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Category</FieldLabel>
                <Select
                  value={values.category}
                  onValueChange={(v) => patch({ category: v ?? values.category })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <FieldLabel>Product Image</FieldLabel>
              <div className="flex flex-wrap items-start gap-4">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="h-24 w-24 rounded-md object-cover shadow-sm"
                  />
                ) : (
                  <span className="flex h-24 w-24 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-sm">
                    {values.name.slice(0, 1) || "A"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-24 min-w-[180px] flex-1 flex-col items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/50 px-4 py-6 text-center transition-colors hover:border-[var(--theme-primary)]/40 hover:bg-muted"
                >
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <span className="mt-2 text-sm font-medium text-foreground">Upload Image</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">JPG, PNG · Max 2MB</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <FieldLabel required>Short Description</FieldLabel>
              <Textarea
                value={values.shortDescription}
                onChange={(e) =>
                  patch({
                    shortDescription: e.target.value.slice(0, SHORT_DESCRIPTION_MAX),
                  })
                }
                rows={3}
                className="resize-none rounded-md"
                placeholder="Brief product description for listings..."
              />
              <p className="text-right text-xs text-muted-foreground">
                {descriptionCount} / {SHORT_DESCRIPTION_MAX}
              </p>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel required>Product Type</FieldLabel>
                <Select
                  value={values.productType}
                  onValueChange={(v) => patch({ productType: v ?? values.productType })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIGITAL_PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Niche</FieldLabel>
                <Select
                  value={values.niche}
                  onValueChange={(v) => patch({ niche: v ?? values.niche })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIGITAL_PRODUCT_NICHES.map((niche) => (
                      <SelectItem key={niche} value={niche}>
                        {niche}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Status</FieldLabel>
                <Select
                  value={values.status}
                  onValueChange={(v) =>
                    patch({ status: (v as DigitalProductFormValues["status"]) ?? values.status })
                  }
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel required>Price (FE)</FieldLabel>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={values.price}
                    onChange={(e) => patch({ price: e.target.value })}
                    className="h-10 rounded-lg pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Vendor</FieldLabel>
                <Input
                  value={values.vendor}
                  onChange={(e) => patch({ vendor: e.target.value })}
                  className="h-10 rounded-md"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={values.featured}
                  onCheckedChange={(checked) => patch({ featured: checked === true })}
                />
                <span className="text-sm font-medium text-foreground">Featured Product</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2.5">
                <Checkbox
                  checked={values.isNew}
                  onCheckedChange={(checked) => patch({ isNew: checked === true })}
                />
                <span className="text-sm font-medium text-foreground">New Product</span>
              </label>
            </div>
          </DashboardCard>

          {/* 2. Offer & Funnel Details */}
          <DashboardCard>
            <SectionHeader number={2} title="Offer & Funnel Details" />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="space-y-5">
                <div className="space-y-2">
                  <FieldLabel required>Sales Page URL (ClickFunnels)</FieldLabel>
                  <Input
                    value={values.salesPageUrl}
                    onChange={(e) => patch({ salesPageUrl: e.target.value })}
                    placeholder="https://..."
                    className="h-10 rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel required>Affiliate Tracking Parameter</FieldLabel>
                  <Input
                    value={values.affiliateTrackingParam}
                    onChange={(e) => patch({ affiliateTrackingParam: e.target.value })}
                    placeholder="affsense_id"
                    className="h-10 rounded-md"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Tracked sales URL preview</FieldLabel>
                  {trackingPreviewUrl ? (
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={trackingPreviewUrl}
                        className="h-10 rounded-md bg-muted font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        onClick={() => void copyText(trackingPreviewUrl, "Tracked URL")}
                        aria-label="Copy tracked URL preview"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
                      Enter a sales page URL to preview how{" "}
                      <code className="rounded bg-muted px-1">?{trackingParamLabel}=</code>
                      {" "}
                      appears in the link.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Sample affiliate value:{" "}
                    <code className="rounded bg-muted px-1">{AFFILIATE_TRACKING_SAMPLE_VALUE}</code>
                    {" "}
                    (replaced with each publisher&apos;s real id when links are generated).
                  </p>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Preview / Demo URL (Optional)</FieldLabel>
                  <Input
                    value={values.previewUrl}
                    onChange={(e) => patch({ previewUrl: e.target.value })}
                    placeholder="https://..."
                    className="h-10 rounded-md"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--theme-primary)]/20 bg-[var(--theme-primary-soft)] p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--theme-primary)]">How it works?</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      Affiliates receive a unique tracking link. When a visitor clicks through,
                      they are redirected to your sales page with{" "}
                      <code className="rounded bg-white/60 px-1">
                        ?{trackingParamLabel}={AFFILIATE_TRACKING_SAMPLE_VALUE}
                      </code>{" "}
                      appended. Conversions are attributed automatically via webhook.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </DashboardCard>

          {/* 3. Commission Settings */}
          <DashboardCard>
            <SectionHeader number={3} title="Commission Settings" />
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel required>Front End Commission</FieldLabel>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={values.frontEndCommission}
                    onChange={(e) => patch({ frontEndCommission: e.target.value })}
                    className="h-10 rounded-lg pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Members earn {values.frontEndCommission || "0"}% on front end sale
                </p>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Upsell Commission</FieldLabel>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={values.upsellCommission}
                    onChange={(e) => patch({ upsellCommission: e.target.value })}
                    className="h-10 rounded-lg pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Members earn {values.upsellCommission || "0"}% on all upsells
                </p>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Direct Referral Reward</FieldLabel>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={values.referralReward}
                    onChange={(e) => patch({ referralReward: e.target.value })}
                    className="h-10 rounded-lg pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  You earn {values.referralReward || "0"}% on referred members&apos; sales
                </p>
              </div>
            </div>
          </DashboardCard>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <div className="xl:sticky xl:top-24 xl:space-y-5">
            <OfferSummaryPanel values={values} imagePreview={imagePreview} />
            <WebhookStatusPanel />
            <PromoMaterialsPanel />
          </div>
        </aside>
      </div>

      {/* Footer actions */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-end gap-2.5">
          <ButtonLink
            href="/admin/digital-products"
            variant="outline"
            className="h-10 rounded-md border-border px-5"
          >
            Cancel
          </ButtonLink>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md border-border px-5"
            onClick={handleSaveDraft}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save as Draft"}
          </Button>
          <Button
            type="button"
            className={cn(
              "h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-5 hover:opacity-90",
              !canPublish && "opacity-60",
            )}
            onClick={handlePublish}
            disabled={saving}
          >
            <Send className="h-4 w-4" />
            {saving ? (isEdit ? "Updating..." : "Publishing...") : isEdit ? "Update Offer" : "Publish Offer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
