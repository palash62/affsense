"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutoresponderProvider, AutoresponderTrigger } from "@prisma/client";
import { CheckCircle2, Loader2, Megaphone, Pencil, Plug, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AutoresponderConnectionForm } from "@/components/advertiser/autoresponder/autoresponder-connection-form";
import { cn } from "@/lib/utils";

type CampaignOption = { id: string; name: string };

type Connection = {
  id: string;
  name: string;
  provider: AutoresponderProvider;
  trigger: AutoresponderTrigger;
  campaignId: string | null;
  isEnabled: boolean;
  config: Record<string, unknown>;
};

const PROVIDER_LABELS: Record<string, string> = {
  WEBHOOK: "Webhook",
  MAILCHIMP: "Mailchimp",
  AWEBER: "AWeber",
  GETRESPONSE: "GetResponse",
  SYSTEME: "Systeme.io",
};

const TRIGGER_LABELS: Record<string, string> = {
  LEAD_CAPTURED: "On submit",
  LEAD_APPROVED: "On approval",
};

export function AutoresponderConnectionsPanel({ campaigns }: { campaigns: CampaignOption[] }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const campaignNames = Object.fromEntries(campaigns.map((c) => [c.id, c.name]));

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/advertiser/autoresponders");
    const json = await res.json();
    setConnections(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleEnabled(conn: Connection) {
    await fetch(`/api/v1/advertiser/autoresponders/${conn.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !conn.isEnabled }),
    });
    void load();
  }

  async function handleTest(id: string) {
    setTestingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/advertiser/autoresponders/${id}/test`, { method: "POST" });
      const json = await res.json().catch(() => null);
      setTestingId(null);
      setMessage(
        res.ok
          ? { type: "ok", text: "Test payload sent successfully." }
          : {
              type: "err",
              text:
                (typeof json?.error?.message === "string" && json.error.message) ||
                (typeof json?.data?.error === "string" && json.data.error) ||
                `Test failed (HTTP ${res.status}). Check your credentials.`,
            },
      );
    } catch {
      setTestingId(null);
      setMessage({ type: "err", text: "Test failed. Check your network connection and try again." });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this autoresponder connection?")) return;
    await fetch(`/api/v1/advertiser/autoresponders/${id}`, { method: "DELETE" });
    void load();
  }

  async function handleEdit(conn: Connection) {
    setMessage(null);
    setEditing(conn);
    window.scrollTo({ top: 0, behavior: "smooth" });

    const res = await fetch(`/api/v1/advertiser/autoresponders/${conn.id}`);
    const json = await res.json().catch(() => null);
    if (res.ok && json?.data) {
      setEditing(json.data as Connection);
      return;
    }

    if (!res.ok) {
      const apiMessage =
        typeof json?.error?.message === "string" ? json.error.message : null;
      setMessage({
        type: "err",
        text:
          apiMessage ??
          "Could not refresh connection details. You can still edit using the last loaded data.",
      });
    }
  }

  return (
    <div className="space-y-8">
      <div
        className="rounded-xl border px-5 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
            <Megaphone className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Applies to your campaigns and opt-in pages</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Leads from publisher traffic and your opt-in pages are sent to your connected lists.
              Scope each connection to all campaigns or a single campaign.
            </p>
          </div>
        </div>
      </div>

      {message && (
        <p
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            message.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {message.text}
        </p>
      )}

      <div className="premium-card">
        <div className="h-1" style={{ background: "var(--theme-gradient-leads)" }} />
        <div className="p-6">
          <h3 className="mb-1 text-lg font-semibold text-foreground">
            {editing ? "Edit integration" : "Add integration"}
          </h3>
          <p className="mb-6 text-sm text-muted-foreground">
            {editing
              ? "Update connection settings, then save changes."
                : "Connect GetResponse, Systeme.io, or a custom webhook."}
          </p>
          <AutoresponderConnectionForm
            campaigns={campaigns}
            initialConnection={editing}
            onCancelEdit={() => setEditing(null)}
            onSaved={(saved) => {
              if (saved) {
                setEditing({
                  ...saved,
                  isEnabled: (saved as Connection).isEnabled ?? true,
                });
              }
              setMessage({ type: "ok", text: "Integration saved successfully." });
              void load();
            }}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-foreground">Your connections</h3>
        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading connections…
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
              <Plug className="h-6 w-6 text-indigo-500" />
            </div>
            <p className="font-medium text-foreground">No integrations yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add a connection above to automatically send campaign leads to your email list.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      conn.isEnabled ? "bg-indigo-50 text-indigo-600" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Plug className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{conn.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="font-normal">
                        {PROVIDER_LABELS[conn.provider] ?? conn.provider}
                      </Badge>
                      <Badge variant="secondary" className="font-normal">
                        {TRIGGER_LABELS[conn.trigger] ?? conn.trigger}
                      </Badge>
                      <Badge variant="outline" className="font-normal">
                        {conn.campaignId
                          ? campaignNames[conn.campaignId] ?? "Campaign"
                          : "All campaigns"}
                      </Badge>
                      {conn.isEnabled ? (
                        <Badge className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="font-normal">
                          Paused
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void toggleEnabled(conn)}
                  >
                    {conn.isEnabled ? "Pause" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={testingId === conn.id}
                    onClick={() => void handleTest(conn.id)}
                  >
                    {testingId === conn.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        Test
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleEdit(conn)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => void handleDelete(conn.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
