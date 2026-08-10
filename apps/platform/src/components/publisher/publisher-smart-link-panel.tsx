"use client";

import { useState } from "react";
import { Check, Copy, Globe, Link2, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  SMART_LINK_PLATFORMS,
  buildSmartLinkUrl,
  sanitizeTrackingParam,
} from "@/lib/smart-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SourceStat = {
  source: string;
  leads: number;
  clicks: number;
};

export function PublisherSmartLinkPanel({
  slug,
  trackingBaseUrl,
  activeCampaignCount,
  sourceBreakdown,
  globalLinkUrl: initialGlobalLinkUrl,
  platformGlobalLinkUrl,
}: {
  slug: string;
  trackingBaseUrl: string;
  activeCampaignCount: number;
  sourceBreakdown: SourceStat[];
  globalLinkUrl: string | null;
  platformGlobalLinkUrl: string | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [customSrc, setCustomSrc] = useState("");
  const [customSubId, setCustomSubId] = useState("");
  const [globalLinkUrl, setGlobalLinkUrl] = useState(initialGlobalLinkUrl ?? "");
  const [savingGlobalLink, setSavingGlobalLink] = useState(false);
  const [globalLinkMessage, setGlobalLinkMessage] = useState<string | null>(null);

  const baseUrl = buildSmartLinkUrl(slug, undefined, trackingBaseUrl);

  async function copyUrl(key: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  const customSrcSafe = sanitizeTrackingParam(customSrc);
  const customSubIdSafe = sanitizeTrackingParam(customSubId);
  const customUrl =
    customSrcSafe || customSubIdSafe
      ? buildSmartLinkUrl(slug, { src: customSrcSafe, subId: customSubIdSafe }, trackingBaseUrl)
      : baseUrl;

  async function saveGlobalLink(e: React.FormEvent) {
    e.preventDefault();
    setSavingGlobalLink(true);
    setGlobalLinkMessage(null);

    const res = await fetch("/api/v1/publisher/global-link", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        globalLinkUrl: globalLinkUrl.trim() || null,
      }),
    });
    const data = await res.json();

    setSavingGlobalLink(false);

    if (!res.ok) {
      setGlobalLinkMessage(data?.error?.message ?? "Unable to save global link");
      return;
    }

    setGlobalLinkMessage("Global link saved.");
  }

  const activeFallback = globalLinkUrl.trim() || platformGlobalLinkUrl;

  return (
    <div className="space-y-6">
      <div
        className="rounded-xl border px-5 py-5"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
            <Sparkles className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">One link, all campaigns</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your Smart Link anywhere. Traffic rotates automatically across active campaigns.
              Add a platform tag to track where your leads come from.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-border border-t-[3px] border-t-violet-500 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-foreground">Your Smart Link</h3>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={baseUrl}
            className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-muted px-4 font-mono text-sm text-foreground"
          />
          <Button
            onClick={() => copyUrl("base", baseUrl)}
            className="h-11 shrink-0 gap-2 rounded-xl bg-[var(--theme-primary)] px-5 hover:opacity-90"
          >
            {copiedKey === "base" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedKey === "base" ? "Copied!" : "Copy Link"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {activeCampaignCount} active campaign{activeCampaignCount === 1 ? "" : "s"} in rotation
        </p>
      </div>

      <div className="rounded-[18px] border border-border border-t-[3px] border-t-indigo-500 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-foreground">Your global fallback link</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          When no campaigns match rotation rules for a visitor, they are redirected here instead of
          seeing an empty page. Leave blank to use the platform default.
        </p>
        <form onSubmit={saveGlobalLink} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="publisher-global-link">Global campaign link</Label>
            <Input
              id="publisher-global-link"
              type="url"
              value={globalLinkUrl}
              onChange={(e) => setGlobalLinkUrl(e.target.value)}
              placeholder="https://example.com/offer"
              className="h-10"
            />
          </div>
          {!globalLinkUrl.trim() && platformGlobalLinkUrl && (
            <p className="text-xs text-muted-foreground">
              Platform default:{" "}
              <span className="font-mono text-muted-foreground">{platformGlobalLinkUrl}</span>
            </p>
          )}
          {activeFallback && (
            <p className="text-xs text-emerald-700">
              Visitors without a matching offer will be sent to your{" "}
              {globalLinkUrl.trim() ? "custom" : "platform"} fallback link.
            </p>
          )}
          {!activeFallback && (
            <p className="text-xs text-amber-700">
              No fallback link configured yet. Set yours below or ask admin to set the platform default.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              disabled={savingGlobalLink}
              className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
            >
              {savingGlobalLink ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {savingGlobalLink ? "Saving..." : "Save global link"}
            </Button>
            {globalLinkMessage && (
              <p
                className={`text-sm ${
                  globalLinkMessage.includes("Unable") ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {globalLinkMessage}
              </p>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-[18px] border border-border border-t-[3px] border-t-sky-500 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Platform links</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Copy a tagged link for each channel you promote on.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SMART_LINK_PLATFORMS.map((platform) => {
            const url = buildSmartLinkUrl(slug, { src: platform.id }, trackingBaseUrl);
            const key = `platform-${platform.id}`;
            return (
              <button
                key={platform.id}
                type="button"
                disabled={false}
                onClick={() => copyUrl(key, url)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm",
                  platform.color,
                )}
              >
                <span className="text-sm font-medium">{platform.label}</span>
                {copiedKey === key ? (
                  <Check className="h-4 w-4 shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 shrink-0 opacity-60" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-[18px] border border-border border-t-[3px] border-t-amber-500 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Custom tracking</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-src">Source tag (?src=)</Label>
            <Input
              id="custom-src"
              placeholder="my-blog"
              value={customSrc}
              onChange={(e) => setCustomSrc(e.target.value)}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-sub">Sub ID (?sub_id=)</Label>
            <Input
              id="custom-sub"
              placeholder="story-01"
              value={customSubId}
              onChange={(e) => setCustomSubId(e.target.value)}
              className="h-10"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            readOnly
            value={customUrl}
            className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-muted px-3 font-mono text-xs text-muted-foreground"
          />
          <Button
            variant="outline"
            onClick={() => copyUrl("custom", customUrl)}
            className="h-10 shrink-0 gap-2"
            disabled={!customSrcSafe && !customSubIdSafe}
          >
            {copiedKey === "custom" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy custom link
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Letters, numbers, underscores, and hyphens only (max 32 chars).</p>
      </div>

      {sourceBreakdown.length > 0 && (
        <div className="rounded-[18px] border border-border border-t-[3px] border-t-emerald-500 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Performance by source</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sourceBreakdown.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell className="font-medium capitalize">{row.source}</TableCell>
                    <TableCell className="text-right">{row.clicks}</TableCell>
                    <TableCell className="text-right">{row.leads}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

    </div>
  );
}
