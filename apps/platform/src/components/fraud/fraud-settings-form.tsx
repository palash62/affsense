"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FraudConfig } from "@/modules/fraud";

type Providers = { ipApiConfigured: boolean; emailApiConfigured: boolean };

export function FraudSettingsForm() {
  const [config, setConfig] = useState<FraudConfig | null>(null);
  const [providers, setProviders] = useState<Providers | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/v1/admin/fraud/settings")
      .then((r) => r.json())
      .then((json) => {
        setConfig(json.data);
        setProviders(json.providers);
        setStatus("idle");
      })
      .catch(() => {
        setError("Failed to load fraud settings");
        setStatus("error");
      });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setStatus("saving");
    setError("");

    const res = await fetch("/api/v1/admin/fraud/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        useRiskDecision: config.useRiskDecision,
        autoApproveMax: config.autoApproveMax,
        manualReviewMax: config.manualReviewMax,
        minFormDurationMs: config.minFormDurationMs,
        duplicateIpWindowHours: config.duplicateIpWindowHours,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setStatus("error");
      setError(json.error?.message ?? "Save failed");
      return;
    }
    setConfig(json.data);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  if (status === "loading" || !config) {
    return <p className="text-sm text-muted-foreground">Loading fraud settings…</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <p className="font-medium text-foreground">Use risk-based decisions</p>
          <p className="text-sm text-muted-foreground">
            When off (shadow mode), fraud scores are recorded but legacy quality rules decide status.
          </p>
        </div>
        <Checkbox
          checked={config.useRiskDecision}
          onCheckedChange={(checked) =>
            setConfig({ ...config, useRiskDecision: checked === true })
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="autoApproveMax">Auto-approve max risk (0–100)</Label>
          <Input
            id="autoApproveMax"
            type="number"
            min={0}
            max={100}
            value={config.autoApproveMax}
            onChange={(e) =>
              setConfig({ ...config, autoApproveMax: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manualReviewMax">Manual review max risk</Label>
          <Input
            id="manualReviewMax"
            type="number"
            min={0}
            max={100}
            value={config.manualReviewMax}
            onChange={(e) =>
              setConfig({ ...config, manualReviewMax: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minFormDurationMs">Min form duration (ms)</Label>
          <Input
            id="minFormDurationMs"
            type="number"
            min={0}
            value={config.minFormDurationMs}
            onChange={(e) =>
              setConfig({ ...config, minFormDurationMs: parseInt(e.target.value, 10) || 0 })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duplicateIpWindowHours">Duplicate IP window (hours)</Label>
          <Input
            id="duplicateIpWindowHours"
            type="number"
            min={1}
            value={config.duplicateIpWindowHours}
            onChange={(e) =>
              setConfig({ ...config, duplicateIpWindowHours: parseInt(e.target.value, 10) || 24 })
            }
          />
        </div>
      </div>

      {providers && (
        <div className="rounded-xl border border-border bg-muted/60 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Optional API providers</p>
          <ul className="mt-2 space-y-1">
            <li>IP lookup (IPinfo): {providers.ipApiConfigured ? "configured" : "not set — set FRAUD_IP_API_KEY"}</li>
            <li>Email validation: {providers.emailApiConfigured ? "configured" : "not set — set FRAUD_EMAIL_API_KEY"}</li>
          </ul>
        </div>
      )}

      <Button type="submit" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save settings"}
      </Button>
    </form>
  );
}
