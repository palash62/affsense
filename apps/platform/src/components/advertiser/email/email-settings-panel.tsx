"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = { fromName: string; replyTo: string };

export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<Settings>({ fromName: "", replyTo: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.data ?? { fromName: "", replyTo: "" }));
    fetch("/api/v1/advertiser/email/provider")
      .then((r) => r.json())
      .then((d) => setProvider(d.data?.marketingProvider ?? null));
  }, []);

  async function saveSettings() {
    setSaving(true);
    const res = await fetch("/api/v1/advertiser/email/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setMessage(res.ok ? "Settings saved" : "Save failed");
  }

  return (
    <div className="space-y-8">
      {provider && provider !== "ses" && (
        <div className="flex max-w-2xl gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p>
            Sending via platform {provider === "mailgun" ? "Mailgun" : "SMTP"}. Custom sending
            domains require Amazon SES configured by an administrator.
          </p>
        </div>
      )}

      <div className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Sender details</h3>
        <div>
          <Label>From name</Label>
          <Input
            value={settings.fromName}
            onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
          />
        </div>
        <div>
          <Label>Reply-to email</Label>
          <Input
            type="email"
            value={settings.replyTo}
            onChange={(e) => setSettings({ ...settings, replyTo: e.target.value })}
          />
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="max-w-xl space-y-2 rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Sending domain</h3>
        <p className="text-sm text-slate-600">
          Add and verify custom domains for branded autoresponder mail on the Domain tab.
        </p>
        <Link
          href="/advertiser/email/domains"
          className="mt-2 inline-flex h-8 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          Manage domains
        </Link>
      </div>

      <div
        className="flex max-w-2xl gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          You are responsible for obtaining subscriber consent. Ensure opt-in pages disclose that
          leads may receive marketing emails from you.
        </p>
      </div>

      {message ? <p className="text-sm text-green-600">{message}</p> : null}
    </div>
  );
}
