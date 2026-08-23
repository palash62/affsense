"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  FlaskConical,
  RefreshCw,
  Save,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import {
  DashboardCard,
  DashboardCardDescription,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Summary = {
  totalReceived: number;
  processed: number;
  failed: number;
  lastActivityAt: string | null;
};

type SettingsState = {
  enabled: boolean;
  name: string;
  affiliateTrackingParam: string;
  webhookSecret: string;
  webhookSecretConfigured: boolean;
  secretHeaderName: string;
  notes: string;
  summary: Summary;
};

type ActivityItem = {
  id: string;
  source: string;
  eventType: string;
  status: string;
  leadEmail: string | null;
  leadName: string | null;
  errorMessage: string | null;
  affiliateRef: string | null;
  publisherId: string | null;
  publisherName: string | null;
  publisherEmail: string | null;
  createdAt: string;
};

type ActivityDetail = ActivityItem & {
  payloadJson: unknown;
};

const EMPTY_SUMMARY: Summary = {
  totalReceived: 0,
  processed: 0,
  failed: 0,
  lastActivityAt: null,
};

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return new Date(iso).toLocaleString();
}

function StatusDot({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-semibold",
        active ? "text-[var(--theme-success)]" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          active ? "bg-[var(--theme-success)]" : "bg-muted-foreground/40",
        )}
      />
      {label}
    </span>
  );
}

function EventStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PROCESSED:
      "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]",
    FAILED: "bg-destructive/10 text-destructive",
    DUPLICATE: "bg-muted text-muted-foreground",
    IGNORED: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function ClickFunnelsWebhookSettingsForm() {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [draftSecret, setDraftSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const platformOrigin = useMemo(() => {
    if (typeof window !== "undefined") return window.location.origin;
    return (
      process.env.NEXT_PUBLIC_PLATFORM_URL?.replace(/\/$/, "") ||
      "https://your-domain.com"
    );
  }, []);

  const globalWebhookUrl = `${platformOrigin}/api/v1/webhooks/clickfunnels`;

  const refreshActivity = useCallback(async () => {
    const res = await fetch(
      "/api/v1/admin/settings/clickfunnels-webhook/activity?limit=20",
    );
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setActivities(json.data?.items ?? []);
      if (json.data?.summary) {
        setSettings((prev) =>
          prev ? { ...prev, summary: json.data.summary } : prev,
        );
      }
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error?.message ?? "Failed to load webhook settings");
      return;
    }
    const data = json.data;
    setSettings({
      enabled: Boolean(data.enabled),
      name: data.name ?? "ClickFunnels",
      affiliateTrackingParam: data.affiliateTrackingParam ?? "affsense_id",
      webhookSecret: "",
      webhookSecretConfigured: Boolean(data.webhookSecretConfigured),
      secretHeaderName: data.secretHeaderName ?? "X-Affsense-Secret",
      notes: data.notes ?? "",
      summary: data.summary ?? EMPTY_SUMMARY,
    });
    setDraftSecret("");
  }, []);

  useEffect(() => {
    void loadSettings().then(() =>
      fetch("/api/v1/admin/settings/clickfunnels-webhook/activity?limit=20")
        .then((r) => r.json())
        .then((json) => {
          if (json.data?.items) setActivities(json.data.items);
        })
        .catch(() => {}),
    );
  }, [loadSettings]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          name: settings.name,
          affiliateTrackingParam: settings.affiliateTrackingParam,
          secretHeaderName: settings.secretHeaderName,
          notes: settings.notes,
          webhookSecret: draftSecret.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to save");
        return;
      }
      const data = json.data;
      setSettings({
        enabled: Boolean(data.enabled),
        name: data.name,
        affiliateTrackingParam: data.affiliateTrackingParam,
        webhookSecret: "",
        webhookSecretConfigured: Boolean(data.webhookSecretConfigured),
        secretHeaderName: data.secretHeaderName,
        notes: data.notes ?? "",
        summary: data.summary ?? settings.summary,
      });
      setDraftSecret("");
      toast.success("Webhook settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateSecret() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateSecret: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to regenerate secret");
        return;
      }
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              webhookSecretConfigured: true,
              summary: json.data?.summary ?? prev.summary,
            }
          : prev,
      );
      setDraftSecret("");
      toast.success("Webhook secret regenerated — update ClickFunnels with the new secret");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook/test", {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Test failed");
        await refreshActivity();
        return;
      }
      toast.success(json.data?.message ?? "Test event processed");
      if (json.data?.summary && settings) {
        setSettings({ ...settings, summary: json.data.summary });
      }
      await refreshActivity();
    } finally {
      setTesting(false);
    }
  }

  async function openDetail(id: string) {
    const res = await fetch(
      `/api/v1/admin/settings/clickfunnels-webhook/activity/${id}`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error?.message ?? "Could not load event");
      return;
    }
    setDetail(json.data);
    setDetailOpen(true);
  }

  if (!settings) {
    return <p className="text-sm text-muted-foreground">Loading webhook settings...</p>;
  }

  const secretDisplay = draftSecret
    ? draftSecret
    : settings.webhookSecretConfigured
      ? "••••••••••••••••••••••••••••••••"
      : "";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Webhook</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your platform-wide webhook integrations.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure webhooks globally. No separate webhook configuration is required for
          individual products or offers.
        </p>
      </div>

      <Alert>
        <AlertDescription>
          <strong>One Global Webhook</strong> — No per-product or per-offer webhook
          configuration is required. Point every ClickFunnels funnel at the same endpoint
          below.
        </AlertDescription>
      </Alert>

      {/* Status summary */}
      <DashboardCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <DashboardCardTitle>Webhook Status</DashboardCardTitle>
            <DashboardCardDescription>Platform-wide ClickFunnels integration</DashboardCardDescription>
          </div>
          <StatusDot
            active={settings.enabled}
            label={settings.enabled ? "Active" : "Inactive"}
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provider
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{settings.name}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Total Received
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {settings.summary.totalReceived.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Processed
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {settings.summary.processed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Failed
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {settings.summary.failed.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Last Activity
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {formatRelativeTime(settings.summary.lastActivityAt)}
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* Global URL card */}
      <DashboardCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Webhook className="h-4 w-4 text-[var(--theme-primary)]" />
            <DashboardCardTitle>ClickFunnels Webhook</DashboardCardTitle>
          </div>
          <span className="rounded-full bg-[var(--theme-primary-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-primary)]">
            Global Webhook
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <StatusDot
            active={settings.enabled}
            label={settings.enabled ? "Active" : "Inactive"}
          />
        </div>
        <div className="mt-4 space-y-2">
          <Label>Webhook URL</Label>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={globalWebhookUrl}
              className="h-10 rounded-md bg-muted font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10 shrink-0 gap-2"
              onClick={() => void copyText(globalWebhookUrl, "Webhook URL")}
            >
              <Copy className="h-4 w-4" />
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use this single webhook endpoint for all ClickFunnels funnels and offers.
          </p>
        </div>
      </DashboardCard>

      {/* Configuration */}
      <DashboardCard>
        <DashboardCardTitle>Configuration</DashboardCardTitle>
        <div className="mt-5 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Webhook Name</Label>
              <Input
                id="wh-name"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="h-10 rounded-md"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex h-10 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, enabled: true })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    settings.enabled
                      ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, enabled: false })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    !settings.enabled
                      ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Inactive
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wh-param">Tracking Parameter</Label>
              <Input
                id="wh-param"
                value={settings.affiliateTrackingParam}
                onChange={(e) =>
                  setSettings({ ...settings, affiliateTrackingParam: e.target.value })
                }
                className="h-10 rounded-md font-mono"
                placeholder="affsense_id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-header">Secret header name</Label>
              <Input
                id="wh-header"
                value={settings.secretHeaderName}
                onChange={(e) =>
                  setSettings({ ...settings, secretHeaderName: e.target.value })
                }
                className="h-10 rounded-md font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-secret">Webhook Secret</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="wh-secret"
                type={showSecret ? "text" : "password"}
                value={showSecret && draftSecret ? draftSecret : secretDisplay}
                onChange={(e) => setDraftSecret(e.target.value)}
                placeholder={
                  settings.webhookSecretConfigured
                    ? "Enter a new secret to replace"
                    : "Enter or generate a secret"
                }
                className="h-10 min-w-[220px] flex-1 rounded-md font-mono"
                autoComplete="new-password"
              />
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                onClick={() => setShowSecret((v) => !v)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showSecret ? "Hide" : "Reveal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2"
                onClick={() => void regenerateSecret()}
                disabled={saving}
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send this secret in header{" "}
              <code className="rounded bg-muted px-1">{settings.secretHeaderName}</code> or JSON
              field <code className="rounded bg-muted px-1">secret</code>.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-notes">Notes (optional)</Label>
            <Textarea
              id="wh-notes"
              value={settings.notes}
              onChange={(e) => setSettings({ ...settings, notes: e.target.value })}
              rows={2}
              className="rounded-md"
            />
          </div>

          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-5 hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DashboardCard>

      {/* Test */}
      <DashboardCard>
        <DashboardCardTitle>Test Webhook</DashboardCardTitle>
        <DashboardCardDescription>
          Send a sample event through the global endpoint to verify configuration.
        </DashboardCardDescription>
        <Button
          type="button"
          variant="outline"
          className="mt-4 h-10 gap-2"
          onClick={() => void sendTest()}
          disabled={testing || !settings.webhookSecretConfigured}
        >
          <FlaskConical className="h-4 w-4" />
          {testing ? "Sending..." : "Send Test Event"}
        </Button>
      </DashboardCard>

      {/* Activity */}
      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <DashboardCardTitle>Recent Webhook Activity</DashboardCardTitle>
          <DashboardCardDescription>
            Latest events received by the global ClickFunnels endpoint
          </DashboardCardDescription>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Time</th>
                <th className="px-5 py-3 font-semibold">Source</th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Lead</th>
                <th className="px-5 py-3 font-semibold">Affiliate</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    No webhook activity yet. Send a test event or wait for ClickFunnels.
                  </td>
                </tr>
              ) : (
                activities.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatRelativeTime(row.createdAt)}
                    </td>
                    <td className="px-5 py-3 font-medium">{row.source}</td>
                    <td className="px-5 py-3 font-mono text-xs">{row.eventType}</td>
                    <td className="px-5 py-3">
                      {row.leadEmail || row.leadName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {row.publisherName ? (
                        <span className="font-medium">{row.publisherName}</span>
                      ) : row.affiliateRef ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.affiliateRef}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <EventStatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => void openDetail(row.id)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DashboardCard>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Webhook event</SheetTitle>
            <SheetDescription>
              {detail ? formatRelativeTime(detail.createdAt) : ""}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <div className="mt-6 space-y-4 px-1 pb-6">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Source</dt>
                  <dd className="mt-0.5 font-medium">{detail.source}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Event</dt>
                  <dd className="mt-0.5 font-mono text-xs">{detail.eventType}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                  <dd className="mt-1">
                    <EventStatusPill status={detail.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Lead</dt>
                  <dd className="mt-0.5">
                    {detail.leadName ? `${detail.leadName} · ` : ""}
                    {detail.leadEmail ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted-foreground">Affiliate</dt>
                  <dd className="mt-0.5">
                    {detail.publisherName ? (
                      <>
                        {detail.publisherName}
                        {detail.publisherEmail ? (
                          <span className="text-muted-foreground"> · {detail.publisherEmail}</span>
                        ) : null}
                      </>
                    ) : detail.affiliateRef ? (
                      <span className="font-mono text-xs">{detail.affiliateRef}</span>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                {detail.errorMessage ? (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">Error</dt>
                    <dd className="mt-0.5 text-destructive">{detail.errorMessage}</dd>
                  </div>
                ) : null}
              </dl>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Payload</p>
                <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-xs">
                  {JSON.stringify(detail.payloadJson, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
