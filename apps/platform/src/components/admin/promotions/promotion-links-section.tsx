"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Info, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildPromotionClickUrl,
  buildPromotionUrl,
  FACEBOOK_PROMOTION_PRESET,
  normalizeUtmTemplate,
} from "@/lib/promotion-attribution";
import type { SerializedPromotion } from "@/services/promotion.service";

type FormState = {
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  landingPath: string;
};

const emptyForm: FormState = {
  name: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  landingPath: "/",
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(label ? `${label} copied` : "Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg" onClick={handleCopy}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function PromotionLinksSection({
  initialPromotions,
}: {
  initialPromotions: SerializedPromotion[];
}) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const previewUrl = useMemo(() => {
    if (!form.utmSource.trim() || !form.utmCampaign.trim() || !origin) return "";
    return buildPromotionUrl(origin, {
      landingPath: form.landingPath || "/",
      utmSource: normalizeUtmTemplate(form.utmSource) ?? form.utmSource.trim(),
      utmMedium: normalizeUtmTemplate(form.utmMedium) || null,
      utmCampaign: normalizeUtmTemplate(form.utmCampaign) ?? form.utmCampaign.trim(),
      utmContent: normalizeUtmTemplate(form.utmContent) || null,
      utmTerm: normalizeUtmTemplate(form.utmTerm) || null,
    });
  }, [form, origin]);

  const applyFacebookPreset = () => {
    setForm({
      name: FACEBOOK_PROMOTION_PRESET.name,
      utmSource: FACEBOOK_PROMOTION_PRESET.utmSource,
      utmMedium: FACEBOOK_PROMOTION_PRESET.utmMedium,
      utmCampaign: FACEBOOK_PROMOTION_PRESET.utmCampaign,
      utmContent: FACEBOOK_PROMOTION_PRESET.utmContent,
      utmTerm: FACEBOOK_PROMOTION_PRESET.utmTerm,
      landingPath: FACEBOOK_PROMOTION_PRESET.landingPath,
    });
  };

  const refreshPromotions = useCallback(async () => {
    const res = await fetch("/api/v1/admin/promotions");
    const data = await res.json();
    if (res.ok && Array.isArray(data.data)) {
      setPromotions(data.data);
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/v1/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        utmSource: form.utmSource.trim(),
        utmMedium: form.utmMedium.trim() || null,
        utmCampaign: form.utmCampaign.trim(),
        utmContent: form.utmContent.trim() || null,
        utmTerm: form.utmTerm.trim() || null,
        landingPath: form.landingPath.trim() || "/",
      }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      toast.error(data.error?.message ?? "Failed to create promotion");
      return;
    }

    toast.success("Promotion created");
    setForm(emptyForm);
    await refreshPromotions();
  }

  async function toggleActive(promotion: SerializedPromotion) {
    setTogglingId(promotion.id);
    const res = await fetch(`/api/v1/admin/promotions/${promotion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promotion.isActive }),
    });
    setTogglingId(null);

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error?.message ?? "Failed to update promotion");
      return;
    }

    setPromotions((prev) =>
      prev.map((row) =>
        row.id === promotion.id ? { ...row, isActive: !row.isActive } : row,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-[var(--radius-card,0.875rem)] border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          Create tracked promotion links for Facebook, Google, or other channels. Share the click URL
          in ads — we log clicks, landing visits, advertiser signups, and completed deposits.
        </p>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Promotion links</h2>
              <p className="text-sm text-muted-foreground">Build UTM templates and copy tracked click URLs</p>
            </div>
            <Button type="button" variant="outline" className="rounded-xl" onClick={applyFacebookPreset}>
              Use Facebook preset
            </Button>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4 border-b border-border px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2 xl:col-span-3">
              <Label htmlFor="promo-name">Name</Label>
              <Input
                id="promo-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Facebook Ads — Spring campaign"
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-source">utm_source</Label>
              <Input
                id="promo-source"
                value={form.utmSource}
                onChange={(e) => setForm((prev) => ({ ...prev, utmSource: e.target.value }))}
                className="rounded-xl font-mono text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-medium">utm_medium</Label>
              <Input
                id="promo-medium"
                value={form.utmMedium}
                onChange={(e) => setForm((prev) => ({ ...prev, utmMedium: e.target.value }))}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-campaign">utm_campaign</Label>
              <Input
                id="promo-campaign"
                value={form.utmCampaign}
                onChange={(e) => setForm((prev) => ({ ...prev, utmCampaign: e.target.value }))}
                className="rounded-xl font-mono text-sm"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-content">utm_content</Label>
              <Input
                id="promo-content"
                value={form.utmContent}
                onChange={(e) => setForm((prev) => ({ ...prev, utmContent: e.target.value }))}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-term">utm_term</Label>
              <Input
                id="promo-term"
                value={form.utmTerm}
                onChange={(e) => setForm((prev) => ({ ...prev, utmTerm: e.target.value }))}
                className="rounded-xl font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-landing">Landing path</Label>
              <Input
                id="promo-landing"
                value={form.landingPath}
                onChange={(e) => setForm((prev) => ({ ...prev, landingPath: e.target.value }))}
                className="rounded-xl font-mono text-sm"
                placeholder="/"
              />
            </div>
          </div>

          {previewUrl ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Landing preview</p>
              <p className="mt-1 break-all font-mono text-xs text-foreground">{previewUrl}</p>
              <div className="mt-2">
                <CopyButton value={previewUrl} label="Landing URL" />
              </div>
            </div>
          ) : null}

          <Button type="submit" className="rounded-xl" disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create promotion
              </>
            )}
          </Button>
        </form>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/60">
                <TableHead className="h-11 px-6 text-muted-foreground">Promotion</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">UTM tuple</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Clicks</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Visits</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Signups</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Active</TableHead>
                <TableHead className="h-11 px-6 text-right text-muted-foreground">Click URL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No promotions yet. Create one above to start tracking.
                  </TableCell>
                </TableRow>
              ) : (
                promotions.map((promotion) => {
                  const clickUrl = origin ? buildPromotionClickUrl(origin, promotion.id) : "";
                  const utmLabel = [
                    promotion.utmSource,
                    promotion.utmMedium ?? "—",
                    promotion.utmCampaign,
                  ].join(" / ");

                  return (
                    <TableRow key={promotion.id} className="border-border hover:bg-muted/40">
                      <TableCell className="px-6 py-4">
                        <p className="font-medium text-foreground">{promotion.name}</p>
                        <p className="text-xs text-muted-foreground">{promotion.landingPath}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono text-xs text-muted-foreground">{utmLabel}</TableCell>
                      <TableCell className="px-4 py-4 text-right tabular-nums">{promotion.clickCount}</TableCell>
                      <TableCell className="px-4 py-4 text-right tabular-nums">{promotion.visitCount}</TableCell>
                      <TableCell className="px-4 py-4 text-right tabular-nums">{promotion.signupCount}</TableCell>
                      <TableCell className="px-4 py-4">
                        <Button
                          type="button"
                          variant={promotion.isActive ? "default" : "outline"}
                          size="sm"
                          className="h-8 rounded-lg"
                          disabled={togglingId === promotion.id}
                          onClick={() => toggleActive(promotion)}
                        >
                          {promotion.isActive ? "Active" : "Inactive"}
                        </Button>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        {clickUrl ? <CopyButton value={clickUrl} label="Click URL" /> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
