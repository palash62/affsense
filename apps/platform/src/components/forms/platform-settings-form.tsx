"use client";

import { useEffect, useState } from "react";
import { Globe, Percent, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  publisherPayoutPercent: number;
  minPayoutAmount: number;
  minPayoutWise: number;
  minPayoutBankTransfer: number;
  minPayoutStripeConnect: number;
  tier1PayoutMin: number;
  tier1PayoutMax: number;
  tier2PayoutMin: number;
  tier2PayoutMax: number;
  tier3PayoutMin: number;
  tier3PayoutMax: number;
  globalLinkUrl: string | null;
};

function TierPayoutRow({
  tier,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  tier: string;
  min: number;
  max: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4">
      <p className="mb-3 text-sm font-semibold text-foreground">{tier}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Min payout (USD)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={min}
            onChange={(e) => onMinChange(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max payout (USD)</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={max}
            onChange={(e) => onMaxChange(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}

export function PlatformSettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  function loadSettings() {
    setLoadError("");
    fetch("/api/v1/admin/settings")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load settings (HTTP ${res.status})`);
        const d = await res.json();
        setSettings(d.data);
      })
      .catch((err) => setLoadError(err?.message ?? "Failed to load settings"));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    if (
      settings.publisherPayoutPercent < 1 ||
      settings.publisherPayoutPercent > 100 ||
      !Number.isFinite(settings.publisherPayoutPercent)
    ) {
      setMessage("Publisher payout must be between 1% and 100%.");
      return;
    }

    setSaving(true);
    setMessage("");
    const res = await fetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.error?.message ?? "Failed to save settings");
      setSaving(false);
      return;
    }
    setSettings(data.data);
    setMessage("Settings saved");
    setSaving(false);
  }

  if (!settings) {
    if (loadError) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadSettings}>
            Retry
          </Button>
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <form onSubmit={save} noValidate className="mx-auto max-w-3xl space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">Publisher payout</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Publisher payout per lead is calculated as CPL multiplied by this percentage (for example,
          $1.00 CPL at 70% pays the publisher $0.70). Changes apply to new paid leads after you save.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="publisherPayoutPercent">Publisher payout (% of CPL)</Label>
            <Input
              id="publisherPayoutPercent"
              type="number"
              step={0.1}
              value={settings.publisherPayoutPercent}
              onChange={(e) =>
                setSettings({ ...settings, publisherPayoutPercent: Number(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">Must be between 1% and 100%.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPayoutWise">Minimum Wise payout ($)</Label>
            <Input
              id="minPayoutWise"
              type="number"
              min={1}
              step={1}
              value={settings.minPayoutWise}
              onChange={(e) =>
                setSettings({ ...settings, minPayoutWise: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPayoutBank">Minimum bank transfer payout ($)</Label>
            <Input
              id="minPayoutBank"
              type="number"
              min={1}
              step={1}
              value={settings.minPayoutBankTransfer}
              onChange={(e) =>
                setSettings({ ...settings, minPayoutBankTransfer: Number(e.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minPayoutStripe">Minimum Stripe payout ($)</Label>
            <Input
              id="minPayoutStripe"
              type="number"
              min={1}
              step={1}
              value={settings.minPayoutStripeConnect}
              onChange={(e) =>
                setSettings({ ...settings, minPayoutStripeConnect: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">
            Tier payout ranges for advertiser bid guidance (USD per lead)
          </h3>
        </div>
        <div className="grid gap-3">
          <TierPayoutRow
            tier="Tier 1 — AU, CA, NZ, GB, US"
            min={settings.tier1PayoutMin}
            max={settings.tier1PayoutMax}
            onMinChange={(v) => setSettings({ ...settings, tier1PayoutMin: v })}
            onMaxChange={(v) => setSettings({ ...settings, tier1PayoutMax: v })}
          />
          <TierPayoutRow
            tier="Tier 2 — AR, BG, BR, CL, IN, ID, LV, MY, MX, PH, PL, ZA, TH, TR"
            min={settings.tier2PayoutMin}
            max={settings.tier2PayoutMax}
            onMinChange={(v) => setSettings({ ...settings, tier2PayoutMin: v })}
            onMaxChange={(v) => setSettings({ ...settings, tier2PayoutMax: v })}
          />
          <TierPayoutRow
            tier="Tier 3 — BD, EG, GH, KE, NG, PK, LK, TZ, UG, VN, ZM"
            min={settings.tier3PayoutMin}
            max={settings.tier3PayoutMax}
            onMinChange={(v) => setSettings({ ...settings, tier3PayoutMin: v })}
            onMaxChange={(v) => setSettings({ ...settings, tier3PayoutMax: v })}
          />
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">Global link</h3>
        </div>
        <Label htmlFor="globalLinkUrl">Global campaign link</Label>
        <Input
          id="globalLinkUrl"
          type="url"
          value={settings.globalLinkUrl ?? ""}
          onChange={(e) =>
            setSettings({ ...settings, globalLinkUrl: e.target.value.trim() || null })
          }
          placeholder="https://example.com/offer"
        />
      </section>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <Button
          type="submit"
          disabled={saving}
          className="bg-[var(--theme-primary)] hover:opacity-90"
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {message && (
          <p
            className={`text-sm ${message.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
