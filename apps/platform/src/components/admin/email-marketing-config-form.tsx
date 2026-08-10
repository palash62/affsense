"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailMarketingPlatformConfig } from "@/lib/email/email-marketing-settings";

export function EmailMarketingConfigForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailsPerDollar, setEmailsPerDollar] = useState("100");
  const [config, setConfig] = useState<EmailMarketingPlatformConfig | null>(null);

  useEffect(() => {
    fetch("/api/v1/admin/email-marketing/config")
      .then((r) => r.json())
      .then((j) => {
        const data = j.data as EmailMarketingPlatformConfig | undefined;
        if (data) {
          setConfig(data);
          setEmailsPerDollar(String(data.emailsPerDollar));
        }
      })
      .catch(() => toast.error("Failed to load email marketing config"))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/email-marketing/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailsPerDollar: Number(emailsPerDollar) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Could not save");
        return;
      }
      setConfig(body.data);
      setEmailsPerDollar(String(body.data.emailsPerDollar));
      toast.success("Email pricing updated");
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  const rate = Number(emailsPerDollar);
  const costPreview =
    Number.isFinite(rate) && rate > 0 ? (1 / rate).toFixed(4) : "—";

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border border-border bg-muted p-4">
        <p className="text-sm font-medium text-foreground">Autoresponder email pricing</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Advertisers fund an Autoresponder wallet from their main wallet. Each
          successful marketing send consumes fund at this global rate.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emailsPerDollar">Emails per $1</Label>
        <Input
          id="emailsPerDollar"
          type="number"
          min={1}
          step={1}
          disabled={loading || saving}
          value={emailsPerDollar}
          onChange={(e) => setEmailsPerDollar(e.target.value)}
          className="max-w-xs bg-white"
        />
        <p className="text-xs text-muted-foreground">
          Cost per email: ${costPreview}
          {config ? ` · Daily send cap: ${config.maxSendsPerDay.toLocaleString()}` : null}
        </p>
      </div>

      <Button type="button" onClick={() => void save()} disabled={loading || saving}>
        {saving ? "Saving…" : "Save pricing"}
      </Button>
    </div>
  );
}
