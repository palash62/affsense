"use client";

import { useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

type SmtpSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  passConfigured: boolean;
  from: string;
  adminAlertEmail: string;
  supportEmail: string;
  appUrl: string;
  enabled: boolean;
  source: "database" | "environment" | "none";
  providerStatus?: {
    provider: "mailgun" | "smtp" | "none";
    source: "database" | "environment" | "none";
    configured: boolean;
  };
};

const SOURCE_LABELS: Record<SmtpSettings["source"], string> = {
  database: "Using settings saved in admin",
  environment: "Using .env variables (no admin SMTP saved)",
  none: "Not configured — emails log to console",
};

export function SmtpSettingsForm() {
  const [settings, setSettings] = useState<SmtpSettings | null>(null);
  const [testTo, setTestTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  function loadSettings() {
    setLoadError("");
    fetch("/api/v1/admin/email/settings")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load SMTP settings (HTTP ${res.status})`);
        const d = await res.json();
        setSettings(d.data);
      })
      .catch((err) => setLoadError(err?.message ?? "Failed to load SMTP settings"));
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

    const res = await fetch("/api/v1/admin/email/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: settings.host,
        port: settings.port,
        secure: settings.secure,
        user: settings.user,
        pass: settings.pass || undefined,
        from: settings.from,
        adminAlertEmail: settings.adminAlertEmail || undefined,
        supportEmail: settings.supportEmail || undefined,
        appUrl: settings.appUrl || undefined,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Failed to save SMTP settings");
      return;
    }

    setSettings(data.data);
    setMessage("SMTP settings saved");
  }

  async function sendTest() {
    setTesting(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/v1/admin/email/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testTo.trim() ? { testTo: testTo.trim() } : {}),
    });

    const data = await res.json().catch(() => null);
    setTesting(false);

    if (!res.ok || !data?.ok) {
      setError(data?.message ?? "SMTP test failed");
      return;
    }

    setMessage(data.message ?? "Test email sent");
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
    return <p className="text-sm text-muted-foreground">Loading SMTP settings...</p>;
  }

  return (
    <div className="space-y-6">
      {settings.providerStatus && !settings.providerStatus.configured && (
        <Alert variant="destructive">
          <AlertDescription>
            Verification and password emails will not send until Mailgun or SMTP is configured.
            AWS SES (below) is for marketing campaigns only.
          </AlertDescription>
        </Alert>
      )}

      <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {SOURCE_LABELS[settings.source]}
        {settings.providerStatus?.provider === "mailgun" && " · Mailgun active via environment"}
      </p>

      <form onSubmit={save} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input
              id="smtpHost"
              value={settings.host}
              onChange={(e) => setSettings({ ...settings, host: e.target.value })}
              placeholder="smtp.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">Port</Label>
            <Input
              id="smtpPort"
              type="number"
              min={1}
              max={65535}
              value={settings.port}
              onChange={(e) => setSettings({ ...settings, port: Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <Checkbox
              id="smtpSecure"
              checked={settings.secure}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, secure: checked === true })
              }
            />
            <Label htmlFor="smtpSecure" className="cursor-pointer font-normal">
              Use TLS/SSL (port 465)
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpUser">Username</Label>
            <Input
              id="smtpUser"
              value={settings.user}
              onChange={(e) => setSettings({ ...settings, user: e.target.value })}
              placeholder="smtp-user"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPass">Password</Label>
            <Input
              id="smtpPass"
              type="password"
              value={settings.pass}
              onChange={(e) => setSettings({ ...settings, pass: e.target.value })}
              placeholder={settings.passConfigured ? "•••••••• (unchanged if empty)" : "SMTP password"}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="smtpFrom">From address</Label>
            <Input
              id="smtpFrom"
              value={settings.from}
              onChange={(e) => setSettings({ ...settings, from: e.target.value })}
              placeholder='Affsense <noreply@leadvix.io>'
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpAdminAlert">Admin alert email</Label>
            <Input
              id="smtpAdminAlert"
              type="email"
              value={settings.adminAlertEmail}
              onChange={(e) => setSettings({ ...settings, adminAlertEmail: e.target.value })}
              placeholder="admin@leadvix.io"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpSupport">Support email (Reply-To)</Label>
            <Input
              id="smtpSupport"
              type="email"
              value={settings.supportEmail}
              onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              placeholder="support@leadvix.io"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpAppUrl">App URL (for email links)</Label>
            <Input
              id="smtpAppUrl"
              type="url"
              value={settings.appUrl}
              onChange={(e) => setSettings({ ...settings, appUrl: e.target.value })}
              placeholder="http://leadvix.io"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" disabled={saving} className="gap-2 bg-[var(--theme-primary)] hover:opacity-90">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save SMTP settings"}
          </Button>
        </div>
      </form>

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

      <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-4">
        <h3 className="text-sm font-semibold text-foreground">Send test email</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label htmlFor="testTo">Recipient (optional)</Label>
            <Input
              id="testTo"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Uses admin alert email if empty"
            />
          </div>
          <Button type="button" variant="outline" disabled={testing} onClick={sendTest} className="gap-2">
            <Mail className="h-4 w-4" />
            {testing ? "Sending..." : "Send test"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Save settings first, then test. Admin settings override .env when SMTP host is saved here.
        </p>
      </div>
    </div>
  );
}
