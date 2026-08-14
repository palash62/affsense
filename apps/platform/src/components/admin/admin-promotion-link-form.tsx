"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, Loader2, Sparkles } from "lucide-react";
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
  buildPromotionUrl,
  FACEBOOK_PROMOTION_PRESET,
} from "@/lib/promotion-attribution";
import type { PromotionRecordWithStats } from "@/services/promotion.service";

type FormState = {
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

const emptyForm: FormState = {
  name: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
};

export function AdminPromotionLinkForm({ appOrigin }: { appOrigin: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState<PromotionRecordWithStats[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadPromotions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/promotions");
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Failed to load promotions");
        return;
      }
      setPromotions(body.data ?? []);
    } catch {
      toast.error("Failed to load promotions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  function applyFacebookPreset() {
    setForm({
      name: FACEBOOK_PROMOTION_PRESET.name,
      utmSource: FACEBOOK_PROMOTION_PRESET.utmSource,
      utmMedium: FACEBOOK_PROMOTION_PRESET.utmMedium,
      utmCampaign: FACEBOOK_PROMOTION_PRESET.utmCampaign,
      utmContent: FACEBOOK_PROMOTION_PRESET.utmContent,
      utmTerm: FACEBOOK_PROMOTION_PRESET.utmTerm,
    });
  }

  const previewUrl = buildPromotionUrl(appOrigin, {
    landingPath: "/",
    utmSource: form.utmSource.trim() || "source",
    utmMedium: form.utmMedium.trim() || undefined,
    utmCampaign: form.utmCampaign.trim() || "campaign",
    utmContent: form.utmContent.trim() || undefined,
    utmTerm: form.utmTerm.trim() || undefined,
  });

  async function copyUrl(key: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function createPromotion(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          utmSource: form.utmSource,
          utmMedium: form.utmMedium || undefined,
          utmCampaign: form.utmCampaign,
          utmContent: form.utmContent || undefined,
          utmTerm: form.utmTerm || undefined,
          landingPath: "/",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Could not create promotion");
        return;
      }
      toast.success("Promotion saved");
      setForm(emptyForm);
      await loadPromotions();
    } catch {
      toast.error("Could not create promotion");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promotion: PromotionRecordWithStats) {
    const res = await fetch(`/api/v1/admin/promotions/${promotion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promotion.isActive }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body?.error?.message ?? "Could not update promotion");
      return;
    }
    await loadPromotions();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-900">UTM tracking links</p>
        <p className="mt-1 text-sm text-slate-600">
          Saved links are the home-page URL with UTM params as typed, including ad macros like
          {" "}
          <code>{"{{campaign.name}}"}</code>. Paste that URL into Meta/Google. Visits and signups
          are attributed from the 30-day cookie.
        </p>
      </div>

      <form onSubmit={(e) => void createPromotion(e)} className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={applyFacebookPreset}>
            <Sparkles className="mr-2 h-4 w-4" />
            Facebook preset
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="promo-name">Promotion name</Label>
            <Input
              id="promo-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Facebook Q1 signup"
              className="rounded-xl border-slate-200 bg-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-source">utm_source</Label>
            <Input
              id="promo-source"
              value={form.utmSource}
              onChange={(e) => setForm((prev) => ({ ...prev, utmSource: e.target.value }))}
              placeholder="facebook"
              className="rounded-xl border-slate-200 bg-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-medium">utm_medium</Label>
            <Input
              id="promo-medium"
              value={form.utmMedium}
              onChange={(e) => setForm((prev) => ({ ...prev, utmMedium: e.target.value }))}
              placeholder="paid"
              className="rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-campaign">utm_campaign</Label>
            <Input
              id="promo-campaign"
              value={form.utmCampaign}
              onChange={(e) => setForm((prev) => ({ ...prev, utmCampaign: e.target.value }))}
              placeholder="{{campaign.name}}"
              className="rounded-xl border-slate-200 bg-white"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-content">utm_content</Label>
            <Input
              id="promo-content"
              value={form.utmContent}
              onChange={(e) => setForm((prev) => ({ ...prev, utmContent: e.target.value }))}
              placeholder="{{ad.name}}"
              className="rounded-xl border-slate-200 bg-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="promo-term">utm_term</Label>
            <Input
              id="promo-term"
              value={form.utmTerm}
              onChange={(e) => setForm((prev) => ({ ...prev, utmTerm: e.target.value }))}
              placeholder="{{adset.name}}"
              className="rounded-xl border-slate-200 bg-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-slate-500">Preview link</p>
              <p className="mt-1 break-all text-sm text-slate-800">{previewUrl}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 rounded-lg"
              onClick={() => void copyUrl("preview", previewUrl)}
            >
              {copiedKey === "preview" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button type="submit" disabled={saving || loading} className="rounded-xl">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save promotion & link"
          )}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="border-none hover:bg-transparent" style={{ background: "var(--theme-primary-soft)" }}>
              <TableHead className="h-11 px-6 text-slate-600">Name</TableHead>
              <TableHead className="h-11 px-4 text-slate-600">UTM</TableHead>
              <TableHead className="h-11 px-4 text-right text-slate-600">Clicks</TableHead>
              <TableHead className="h-11 px-4 text-right text-slate-600">Visits</TableHead>
              <TableHead className="h-11 px-4 text-right text-slate-600">Signups</TableHead>
              <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
              <TableHead className="h-11 px-4 text-right text-slate-600">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  Loading promotions…
                </TableCell>
              </TableRow>
            ) : promotions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  No saved promotions yet.
                </TableCell>
              </TableRow>
            ) : (
              promotions.map((promotion) => {
                const url = buildPromotionUrl(appOrigin, promotion);
                return (
                  <TableRow key={promotion.id} className="border-slate-100">
                    <TableCell className="px-6 py-4 font-medium text-slate-900">{promotion.name}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-slate-600">
                      <div className="space-y-0.5">
                        <p>source: {promotion.utmSource}</p>
                        <p>medium: {promotion.utmMedium ?? "—"}</p>
                        <p>campaign: {promotion.utmCampaign}</p>
                        <p>content: {promotion.utmContent ?? "—"}</p>
                        <p>term: {promotion.utmTerm ?? "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-slate-700">
                      {promotion.clickCount}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-slate-700">
                      {promotion.visitCount}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm tabular-nums text-slate-700">
                      {promotion.signupCount}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => void toggleActive(promotion)}
                      >
                        {promotion.isActive ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => void copyUrl(promotion.id, url)}
                      >
                        {copiedKey === promotion.id ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy link
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
