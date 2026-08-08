"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = { fromName: string; fromEmail: string; replyTo: string };

type MailboxOption = {
  id: string;
  email: string;
  fromName: string | null;
  isDefault: boolean;
};

type IdentityOption = {
  id: string;
  domain: string;
  fromEmail: string;
  verificationStatus: string;
  ready?: boolean;
  mailboxes?: MailboxOption[];
};

function flattenVerifiedMailboxes(identities: IdentityOption[]) {
  return identities
    .filter((i) => i.verificationStatus === "VERIFIED" || i.ready)
    .flatMap((i) => {
      const boxes =
        i.mailboxes && i.mailboxes.length > 0
          ? i.mailboxes
          : [
              {
                id: i.id,
                email: i.fromEmail,
                fromName: null as string | null,
                isDefault: true,
              },
            ];
      return boxes.map((m) => ({ ...m, domain: i.domain }));
    });
}

export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<Settings>({
    fromName: "",
    fromEmail: "",
    replyTo: "",
  });
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<string | null>(null);

  const verifiedMailboxes = flattenVerifiedMailboxes(identities);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/settings")
      .then((r) => r.json())
      .then((d) =>
        setSettings({
          fromName: d.data?.fromName ?? "",
          fromEmail: d.data?.fromEmail ?? "",
          replyTo: d.data?.replyTo ?? "",
        }),
      );
    fetch("/api/v1/advertiser/email/identities")
      .then((r) => r.json())
      .then((d) => setIdentities((d.data ?? []) as IdentityOption[]));
    fetch("/api/v1/advertiser/email/provider")
      .then((r) => r.json())
      .then((d) => setProvider(d.data?.marketingProvider ?? null));
  }, []);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    setError("");
    if (!settings.fromEmail.trim()) {
      setSaving(false);
      setError("Select a default from email from a verified domain");
      return;
    }
    const res = await fetch("/api/v1/advertiser/email/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const json = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "Save failed");
      return;
    }
    setMessage("Settings saved");
  }

  return (
    <div className="space-y-8">
      {provider === "mailgun" ? (
        <div className="flex max-w-2xl gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p>
            Sending via Mailgun. Add and verify your domain on the{" "}
            <Link href="/advertiser/email/domains" className="font-medium underline underline-offset-2">
              Domain
            </Link>{" "}
            tab (DNS records → Refresh) to send from your brand address.
          </p>
        </div>
      ) : provider && provider !== "ses" ? (
        <div className="flex max-w-2xl gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p>
            Sending via platform {provider.toUpperCase()}. Custom branded domains are available when
            Mailgun or Amazon SES is configured by an administrator.
          </p>
        </div>
      ) : null}

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
          <Label>Default from email</Label>
          {verifiedMailboxes.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">
              No verified sending emails yet.{" "}
              <Link
                href="/advertiser/email/domains"
                className="font-medium underline underline-offset-2"
              >
                Add and verify a domain
              </Link>{" "}
              first.
            </p>
          ) : (
            <select
              className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              required
            >
              <option value="">Select sending email…</option>
              {verifiedMailboxes.map((m) => (
                <option key={m.id} value={m.email}>
                  {m.email}
                </option>
              ))}
            </select>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Automations use this address when an email action does not override the sender.
          </p>
        </div>
        <div>
          <Label>Reply-to email</Label>
          <Input
            type="email"
            value={settings.replyTo}
            onChange={(e) => setSettings({ ...settings, replyTo: e.target.value })}
          />
        </div>
        <Button
          onClick={saveSettings}
          disabled={saving || verifiedMailboxes.length === 0}
        >
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
    </div>
  );
}
