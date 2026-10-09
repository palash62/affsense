"use client";

import { useEffect, useState } from "react";
import { Check, Copy, CreditCard, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type StripeSettings = {
  publishableKey: string;
  secretKey: string;
  secretKeyConfigured: boolean;
  webhookSecret: string;
  webhookSecretConfigured: boolean;
  enabled: boolean;
  source: "database" | "environment" | "none";
};

const SOURCE_LABELS: Record<StripeSettings["source"], string> = {
  database: "Using settings saved in admin",
  environment: "Using .env variables (no admin Stripe config saved)",
  none: "Not configured — advertisers and Solo Ads buyers cannot pay by card",
};

const WEBHOOK_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "charge.refunded",
  "charge.dispute.created",
];

export function StripeSettingsForm() {
  const [settings, setSettings] = useState<StripeSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/v1/webhooks/stripe`);
  }, []);

  function copyWebhookUrl() {
    navigator.clipboard
      .writeText(webhookUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  }

  function loadSettings() {
    setLoadError("");
    fetch("/api/v1/admin/payments/stripe")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load Stripe settings (HTTP ${res.status})`);
        const d = await res.json();
        setSettings(d.data);
      })
      .catch((err) => setLoadError(err?.message ?? "Failed to load Stripe settings"));
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/v1/admin/payments/stripe", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publishableKey: settings.publishableKey,
        secretKey: settings.secretKey || undefined,
        webhookSecret: settings.webhookSecret || undefined,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Failed to save Stripe settings");
      return;
    }

    setSettings(data.data);
    setMessage("Stripe settings saved");
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
    return <p className="text-sm text-muted-foreground">Loading Stripe settings...</p>;
  }

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {SOURCE_LABELS[settings.source]}
      </p>

      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stripePublishableKey">Publishable key</Label>
            <Input
              id="stripePublishableKey"
              value={settings.publishableKey}
              onChange={(e) => setSettings({ ...settings, publishableKey: e.target.value })}
              placeholder="pk_test_..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              From Stripe Dashboard → Developers → API keys
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stripeSecretKey">Secret key</Label>
            <Input
              id="stripeSecretKey"
              type="password"
              value={settings.secretKey}
              onChange={(e) => setSettings({ ...settings, secretKey: e.target.value })}
              placeholder={settings.secretKeyConfigured ? "•••••••• (leave blank to keep)" : "sk_test_..."}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="stripeWebhookSecret">Webhook secret (optional)</Label>
            <Input
              id="stripeWebhookSecret"
              type="password"
              value={settings.webhookSecret}
              onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
              placeholder={
                settings.webhookSecretConfigured
                  ? "•••••••• (leave blank to keep)"
                  : "whsec_..."
              }
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Card deposits verify on the server after checkout, so this is optional. Add it to receive
              Solo Ads refunds, disputes and payments where the buyer closed the browser early.
            </p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label htmlFor="stripeWebhookUrl">Webhook endpoint</Label>
            <div className="flex gap-2">
              <Input id="stripeWebhookUrl" value={webhookUrl} readOnly className="font-mono text-sm" />
              <Button type="button" variant="outline" onClick={copyWebhookUrl} disabled={!webhookUrl}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              In Stripe Dashboard → Developers → Webhooks, add this endpoint, then paste its signing
              secret (<code>whsec_…</code>) above.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-foreground">Events to send</p>
            <ul className="flex flex-wrap gap-1.5">
              {WEBHOOK_EVENTS.map((event) => (
                <li key={event} className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                  {event}
                </li>
              ))}
            </ul>
          </div>
        </div>

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

        <Button type="submit" disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Stripe settings"}
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-muted/80 p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
          <p>
            Once saved, advertisers can add wallet funds on{" "}
            <strong>/advertiser/wallet</strong> and Solo Ads buyers can fund their Ad Wallet on{" "}
            <strong>/publisher/solo-ads/wallet</strong> using Stripe card checkout. Use test keys
            (`pk_test_` / `sk_test_`) in development.
          </p>
        </div>
      </div>
    </div>
  );
}
