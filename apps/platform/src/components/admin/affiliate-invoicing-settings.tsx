"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIMEZONE_OPTIONS } from "@/lib/user-timezone";

type SettingsState = {
  enabled: boolean;
  minimumAmount: number;
  netTermDays: number;
  timezone: string;
  startAt: string;
};

/** `datetime-local` needs `yyyy-MM-ddTHH:mm`, not a full ISO string. */
function toLocalInputValue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AffiliateInvoicingSettingsForm() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/v1/admin/settings/affiliate-invoicing");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error?.message ?? "Failed to load invoicing settings");
      return;
    }
    setSettings(json.data as SettingsState);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings/affiliate-invoicing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save");
        return;
      }
      setSettings(json.data);
      toast.success("Invoicing settings saved");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading invoicing settings…</p>;
  }

  return (
    <div className="space-y-6">
      <DashboardCard>
        <DashboardCardTitle>Weekly invoicing</DashboardCardTitle>
        <DashboardCardDescription>
          Affiliate earnings accrue Monday to Sunday. Every Monday an invoice is raised for
          all uninvoiced earnings once they reach the minimum, and it stays unpaid until an
          admin records the payment.
        </DashboardCardDescription>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>Invoicing enabled</Label>
            <Select
              value={settings.enabled ? "on" : "off"}
              onValueChange={(v) => {
                if (v) setSettings({ ...settings, enabled: v === "on" });
              }}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on">Enabled</SelectItem>
                <SelectItem value="off">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              While enabled, affiliates are paid through invoices and cannot request payouts
              themselves.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Minimum invoice amount (USD)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={settings.minimumAmount}
              onChange={(e) =>
                setSettings({ ...settings, minimumAmount: Number(e.target.value) || 0 })
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Below this, earnings stay uninvoiced and roll into the next Monday, so nothing
              is lost.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Payment term (days)</Label>
            <Input
              type="number"
              min={0}
              value={settings.netTermDays}
              onChange={(e) =>
                setSettings({ ...settings, netTermDays: Number(e.target.value) || 0 })
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Net-{settings.netTermDays}: invoices fall due {settings.netTermDays} days after
              they are issued.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Week timezone</Label>
            <Select
              value={settings.timezone}
              onValueChange={(v) => {
                if (v) setSettings({ ...settings, timezone: v });
              }}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Decides where Monday starts and Sunday ends for every invoice period.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Invoicing starts from</Label>
            <Input
              type="datetime-local"
              value={toLocalInputValue(settings.startAt)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  startAt: e.target.value ? new Date(e.target.value).toISOString() : "",
                })
              }
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              Earnings before this instant are never invoiced. Set it to the Monday you go
              live so affiliates are not billed again for money already withdrawn through the
              old payout flow. Leaving it empty makes every past earning invoiceable.
            </p>
          </div>

          <div className="flex justify-end">
            <Button type="button" disabled={saving} onClick={() => void save()} className="gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
