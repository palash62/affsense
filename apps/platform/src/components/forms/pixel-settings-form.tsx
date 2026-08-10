"use client";

import { useEffect, useState } from "react";
import { Crosshair, Save } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isValidGoogleConversionId,
  isValidMetaPixelId,
  type PlatformPixelConfig,
} from "@/lib/tracking/platform-pixel-settings";

const EMPTY_SETTINGS: PlatformPixelConfig = {
  version: 1,
  meta: { enabled: false, pixelId: "" },
  googleAds: { enabled: false, conversionId: "", conversionLabel: "" },
};

export function PixelSettingsForm() {
  const [settings, setSettings] = useState<PlatformPixelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/admin/settings/pixels")
      .then((r) => r.json())
      .then((d) => setSettings(d.data ?? EMPTY_SETTINGS))
      .catch(() => setSettings(EMPTY_SETTINGS));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/v1/admin/settings/pixels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meta: settings.meta,
        googleAds: settings.googleAds,
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Failed to save pixel settings");
      return;
    }

    setSettings(data.data);
    setMessage("Pixel settings saved");
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading pixel settings...</p>;
  }

  const metaActive =
    settings.meta.enabled && isValidMetaPixelId(settings.meta.pixelId);
  const googleActive =
    settings.googleAds.enabled &&
    isValidGoogleConversionId(settings.googleAds.conversionId) &&
    settings.googleAds.conversionLabel.trim().length > 0;

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-8">
      <Alert>
        <AlertDescription>
          Tracking scripts load across the <strong>whole platform</strong> when
          enabled. Meta fires <strong>PageView</strong> site-wide,{" "}
          <strong>Lead</strong> on signup and accepted opt-in/landing submits, and{" "}
          <strong>Purchase</strong> on successful card wallet deposits. Google Ads
          conversions still fire only on accepted opt-in or landing form
          submissions.
        </AlertDescription>
      </Alert>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Facebook Pixel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Load Meta Pixel site-wide: PageView everywhere, Lead on signup and
              form leads, Purchase on card deposits.
            </p>
            {metaActive ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Active — PageView, signup Lead, form Lead, and deposit Purchase.
              </p>
            ) : settings.meta.enabled ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Enabled but inactive — enter a valid numeric Pixel ID and save.
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={settings.meta.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  meta: { ...settings.meta, enabled: e.target.checked },
                })
              }
              className="accent-blue-600"
            />
            Enabled
          </label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="metaPixelId">Pixel ID</Label>
          <Input
            id="metaPixelId"
            value={settings.meta.pixelId}
            disabled={!settings.meta.enabled || saving}
            onChange={(e) =>
              setSettings({
                ...settings,
                meta: { ...settings.meta, pixelId: e.target.value },
              })
            }
            placeholder="123456789012345"
            className="font-mono text-sm"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Google Ads</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Load gtag.js site-wide and fire conversion events on accepted leads.
            </p>
            {googleActive ? (
              <p className="mt-2 text-xs font-medium text-emerald-700">
                Active — conversions will fire on accepted lead submissions.
              </p>
            ) : settings.googleAds.enabled ? (
              <p className="mt-2 text-xs font-medium text-amber-700">
                Enabled but inactive — enter a valid Conversion ID (AW-…) and Label,
                then save.
              </p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={settings.googleAds.enabled}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  googleAds: { ...settings.googleAds, enabled: e.target.checked },
                })
              }
              className="accent-blue-600"
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="googleConversionId">Conversion ID</Label>
            <Input
              id="googleConversionId"
              value={settings.googleAds.conversionId}
              disabled={!settings.googleAds.enabled || saving}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  googleAds: {
                    ...settings.googleAds,
                    conversionId: e.target.value,
                  },
                })
              }
              placeholder="AW-123456789"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="googleConversionLabel">Conversion Label</Label>
            <Input
              id="googleConversionLabel"
              value={settings.googleAds.conversionLabel}
              disabled={!settings.googleAds.enabled || saving}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  googleAds: {
                    ...settings.googleAds,
                    conversionLabel: e.target.value,
                  },
                })
              }
              placeholder="AbCDeFGhIJkLmNoP"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save pixel settings"}
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" />
          Settings apply site-wide when enabled: signup Lead, form Lead, and card
          deposit Purchase for Meta; Google conversions on accepted form submits.
        </div>
      </div>
    </form>
  );
}
