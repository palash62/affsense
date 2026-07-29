"use client";

import { useEffect, useState } from "react";
import { Info, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Settings = { fromName: string; replyTo: string };

type Identity = {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  verificationStatus: string;
  isDefault: boolean;
  dkimTokens: string[] | null;
};

export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<Settings>({ fromName: "", replyTo: "" });
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [domain, setDomain] = useState("");
  const [domainFromName, setDomainFromName] = useState("");
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
    loadIdentities();
  }, []);

  function loadIdentities() {
    fetch("/api/v1/advertiser/email/identities")
      .then((r) => r.json())
      .then((d) => setIdentities(d.data ?? []));
  }

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

  async function addDomain() {
    const res = await fetch("/api/v1/advertiser/email/identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, fromName: domainFromName || settings.fromName }),
    });
    if (res.ok) {
      setDomain("");
      loadIdentities();
      setMessage("Domain verification started — add DNS records below");
    }
  }

  async function refreshIdentity(id: string) {
    await fetch("/api/v1/advertiser/email/identities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh", identityId: id }),
    });
    loadIdentities();
  }

  return (
    <div className="space-y-8">
      {provider && provider !== "ses" && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 max-w-2xl">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <p>
            Sending via platform {provider === "mailgun" ? "Mailgun" : "SMTP"}. Custom domain verification below is optional and requires AWS SES to be configured by an administrator.
          </p>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4 max-w-xl">
        <h3 className="font-semibold text-slate-900">Sender details</h3>
        <div>
          <Label>From name</Label>
          <Input value={settings.fromName} onChange={(e) => setSettings({ ...settings, fromName: e.target.value })} />
        </div>
        <div>
          <Label>Reply-to email</Label>
          <Input type="email" value={settings.replyTo} onChange={(e) => setSettings({ ...settings, replyTo: e.target.value })} />
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <h3 className="font-semibold text-slate-900">Custom sending domain</h3>
        <p className="text-sm text-slate-600">Verify your own domain for better deliverability and branding.</p>
        <div className="flex flex-wrap gap-3 max-w-xl">
          <Input placeholder="mail.yourcompany.com" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <Input placeholder="From name" value={domainFromName} onChange={(e) => setDomainFromName(e.target.value)} />
          <Button onClick={addDomain} disabled={!domain}>Add domain</Button>
        </div>

        {identities.map((id) => (
          <div key={id.id} className="rounded-lg border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{id.domain}</p>
                <p className="text-sm text-slate-500">{id.fromEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={id.verificationStatus === "VERIFIED" ? "default" : "secondary"}>
                  {id.verificationStatus}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => refreshIdentity(id.id)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {id.verificationStatus === "PENDING" && Array.isArray(id.dkimTokens) && id.dkimTokens.length > 0 && (
              <div className="mt-3 text-xs text-slate-600">
                <p className="font-medium">Add these CNAME records to your DNS:</p>
                <ul className="mt-1 space-y-1 font-mono">
                  {id.dkimTokens.map((token) => (
                    <li key={token}>{token}._domainkey.{id.domain}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-slate-700 max-w-2xl"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          You are responsible for obtaining subscriber consent. Ensure opt-in pages disclose that leads may receive marketing emails from you.
        </p>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
    </div>
  );
}
