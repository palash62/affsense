"use client";

import { useEffect, useState } from "react";
import { Banknote, Building2, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Settings = {
  publisherPayoutPercent: number;
  minPayoutAmount: number;
  minAdvertiserWithdrawAmount: number;
  adminPayBankDetails: string;
  adminPayWise: string;
  adminPayPaypal: string;
  adminPayStripe: string;
};

function fromApi(data: Record<string, unknown>): Settings {
  return {
    publisherPayoutPercent: Number(data.publisherPayoutPercent),
    minPayoutAmount: Number(data.minPayoutAmount),
    minAdvertiserWithdrawAmount: Number(data.minAdvertiserWithdrawAmount),
    adminPayBankDetails: typeof data.adminPayBankDetails === "string" ? data.adminPayBankDetails : "",
    adminPayWise: typeof data.adminPayWise === "string" ? data.adminPayWise : "",
    adminPayPaypal: typeof data.adminPayPaypal === "string" ? data.adminPayPaypal : "",
    adminPayStripe: typeof data.adminPayStripe === "string" ? data.adminPayStripe : "",
  };
}

export function WithdrawSettingsForm() {
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
        setSettings(fromApi(d.data));
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

    if (!Number.isFinite(settings.minPayoutAmount) || settings.minPayoutAmount < 1) {
      setMessage("Publisher minimum invoice must be at least $1.");
      return;
    }

    if (
      !Number.isFinite(settings.minAdvertiserWithdrawAmount) ||
      settings.minAdvertiserWithdrawAmount < 1
    ) {
      setMessage("Advertiser minimum invoice must be at least $1.");
      return;
    }

    const payload = {
      publisherPayoutPercent: settings.publisherPayoutPercent,
      minPayoutAmount: settings.minPayoutAmount,
      minAdvertiserWithdrawAmount: settings.minAdvertiserWithdrawAmount,
      adminPayBankDetails: settings.adminPayBankDetails.trim() || null,
      adminPayWise: settings.adminPayWise.trim() || null,
      adminPayPaypal: settings.adminPayPaypal.trim() || null,
      adminPayStripe: settings.adminPayStripe.trim() || null,
    };

    setSaving(true);
    setMessage("");
    const res = await fetch("/api/v1/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data?.error?.message ?? "Failed to save settings");
      setSaving(false);
      return;
    }
    setSettings(fromApi(data.data));
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
          <Banknote className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">Weekly invoice minimums</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Monday invoice floors. Below these amounts, unbilled totals carry forward to the next
          Monday. CPA offer publisher payouts are set per offer by admin — not here.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minPayoutAmount">Minimum invoice — Publisher ($)</Label>
            <Input
              id="minPayoutAmount"
              type="number"
              min={1}
              step={1}
              value={settings.minPayoutAmount}
              onChange={(e) =>
                setSettings({ ...settings, minPayoutAmount: Number(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Affiliate weekly invoices (platform pays publisher).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="minAdvertiserWithdrawAmount">
              Minimum invoice — Advertiser ($)
            </Label>
            <Input
              id="minAdvertiserWithdrawAmount"
              type="number"
              min={1}
              step={1}
              value={settings.minAdvertiserWithdrawAmount}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  minAdvertiserWithdrawAmount: Number(e.target.value),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              CPA AR invoices: advertiser pays admin full offer revenue once this floor is met.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">
            Receive payment details (advertiser invoices)
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          IDs and addresses only — no online checkout. Advertisers see these when paying CPA
          invoices offline.
        </p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminPayBankDetails">Bank details</Label>
            <Textarea
              id="adminPayBankDetails"
              rows={4}
              value={settings.adminPayBankDetails}
              onChange={(e) =>
                setSettings({ ...settings, adminPayBankDetails: e.target.value })
              }
              placeholder="Account name, bank, account number, routing / SWIFT…"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="adminPayWise">Wise ID / email</Label>
              <Input
                id="adminPayWise"
                value={settings.adminPayWise}
                onChange={(e) => setSettings({ ...settings, adminPayWise: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPayPaypal">PayPal email / ID</Label>
              <Input
                id="adminPayPaypal"
                value={settings.adminPayPaypal}
                onChange={(e) => setSettings({ ...settings, adminPayPaypal: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminPayStripe">Stripe account email / ID</Label>
              <Input
                id="adminPayStripe"
                value={settings.adminPayStripe}
                onChange={(e) => setSettings({ ...settings, adminPayStripe: e.target.value })}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-[var(--theme-primary)]" />
          <h3 className="text-sm font-semibold text-foreground">CPL publisher payout</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Used for <span className="font-medium">CPL campaigns</span> only: publisher earn is CPL ×
          this percentage (e.g. $1.00 CPL at 70% = $0.70).
        </p>
        <div className="max-w-xs space-y-2">
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
            className={`text-sm ${message.includes("Failed") || message.includes("must be") ? "text-red-600" : "text-emerald-600"}`}
          >
            {message}
          </p>
        )}
      </div>
    </form>
  );
}

/** @deprecated Use WithdrawSettingsForm */
export const PlatformSettingsForm = WithdrawSettingsForm;
