"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
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

type SettingsState = {
  enabled: boolean;
  apiKey: string;
  apiKeyConfigured: boolean;
  endpoint: string;
  max: number;
  affiliatePercent: number;
  postbackSecret: string;
  postbackSecretConfigured: boolean;
  postbackUrl: string;
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function OgadsOfferWallSettingsForm() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [draftApiKey, setDraftApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/admin/settings/offer-wall");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error?.message ?? "Failed to load Offer Wall settings");
      return;
    }
    const data = json.data as SettingsState;
    setSettings(data);
    setDraftApiKey("");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const postbackDisplay = useMemo(() => settings?.postbackUrl ?? "", [settings]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings/offer-wall", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          endpoint: settings.endpoint,
          max: settings.max,
          affiliatePercent: settings.affiliatePercent,
          apiKey: draftApiKey.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save");
        return;
      }
      setSettings(json.data);
      setDraftApiKey("");
      toast.success("Offer Wall settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateSecret() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/v1/admin/settings/offer-wall", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateSecret: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to regenerate secret");
        return;
      }
      setSettings(json.data);
      toast.success("Postback secret regenerated — update OGAds postback URL");
    } finally {
      setRegenerating(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading Offer Wall settings…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <DashboardCard>
        <DashboardCardTitle>OGAds Offer API</DashboardCardTitle>
        <DashboardCardDescription>
          Generate a key at members.ogads.com → Tools → Offer API, then paste it here. Affiliates
          see live offers on /publisher/offer-wall.
        </DashboardCardDescription>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>Enabled</Label>
            <Select
              value={settings.enabled ? "yes" : "no"}
              onValueChange={(v) =>
                setSettings((prev) => (prev ? { ...prev, enabled: v === "yes" } : prev))
              }
            >
              <SelectTrigger className="h-11 max-w-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Yes</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>API endpoint</Label>
            <Input
              value={settings.endpoint}
              onChange={(e) =>
                setSettings((prev) => (prev ? { ...prev, endpoint: e.target.value } : prev))
              }
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Max offers</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={settings.max}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? { ...prev, max: Number(e.target.value) || prev.max }
                    : prev,
                )
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Requested count (up to 200). OGAds still geo-filters by visitor IP/device, so the
              live wall is smaller than the members catalog.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Affiliate earn %</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={settings.affiliatePercent}
              onChange={(e) =>
                setSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        affiliatePercent: Number(e.target.value) || prev.affiliatePercent,
                      }
                    : prev,
                )
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Share of the OGAds payout affiliates see and earn. If OGAds pays $1.00 and this is
              70, affiliates see and earn $0.70.
            </p>
          </div>

          <div className="space-y-2">
            <Label>API key</Label>
            <Input
              value={draftApiKey}
              onChange={(e) => setDraftApiKey(e.target.value)}
              placeholder={
                settings.apiKeyConfigured
                  ? "•••••••••••• (leave blank to keep current)"
                  : "Paste OGAds Offer API key"
              }
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {settings.apiKeyConfigured
                ? "A key is already saved. Enter a new value only to replace it."
                : "Required before affiliates can see offers."}
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={saving} onClick={() => void save()} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DashboardCard>

      <DashboardCard>
        <DashboardCardTitle>Postback URL</DashboardCardTitle>
        <DashboardCardDescription>
          Paste this into OGAds Tools → Postback URL so conversions credit the affiliate wallet.
          Include macros like offer_id, aff_sub4, payout, and ip when OGAds supports them.
        </DashboardCardDescription>

        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={postbackDisplay} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 gap-2"
              onClick={() => void copyText(postbackDisplay, "Postback URL")}
              disabled={!postbackDisplay}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={regenerating}
            onClick={() => void regenerateSecret()}
          >
            <RefreshCw className="h-4 w-4" />
            {regenerating ? "Regenerating…" : "Regenerate postback secret"}
          </Button>
          {!settings.postbackSecretConfigured ? (
            <p className="text-xs text-amber-700">
              Generate a secret so the webhook URL includes ?secret=… for verification.
            </p>
          ) : null}
        </div>
      </DashboardCard>
    </div>
  );
}
