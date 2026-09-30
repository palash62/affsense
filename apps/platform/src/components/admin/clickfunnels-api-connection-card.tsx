"use client";

import { useState } from "react";
import { KeyRound, Link2, PlugZap, Unplug } from "lucide-react";
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
import { cn } from "@/lib/utils";

export type ClickFunnelsApiState = {
  apiTokenConfigured: boolean;
  apiTokenMasked: string;
  apiWorkspaceId: string;
  apiWorkspaceSubdomain: string;
  apiWorkspaceName: string;
};

type Workspace = {
  id: string;
  name: string;
  subdomain: string;
  teamName: string | null;
};

export function ClickFunnelsApiConnectionCard({
  value,
  onChange,
}: {
  value: ClickFunnelsApiState;
  onChange: (next: ClickFunnelsApiState) => void;
}) {
  const [draftToken, setDraftToken] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"connect" | "save" | "test" | "disconnect" | null>(null);

  const connected = value.apiTokenConfigured && Boolean(value.apiWorkspaceId);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error?.message ?? "Failed to save ClickFunnels API settings");
      return false;
    }
    const data = json.data ?? {};
    onChange({
      apiTokenConfigured: Boolean(data.apiTokenConfigured),
      apiTokenMasked: data.apiTokenMasked ?? "",
      apiWorkspaceId: data.apiWorkspaceId ?? "",
      apiWorkspaceSubdomain: data.apiWorkspaceSubdomain ?? "",
      apiWorkspaceName: data.apiWorkspaceName ?? "",
    });
    return true;
  }

  async function connect() {
    const token = draftToken.trim();
    if (!token && !value.apiTokenConfigured) {
      toast.error("Paste your ClickFunnels API access token first");
      return;
    }
    setBusy("connect");
    try {
      const res = await fetch("/api/v1/admin/settings/clickfunnels-webhook/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { apiToken: token } : {}),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Could not connect to ClickFunnels");
        return;
      }
      const list = (json.data ?? []) as Workspace[];
      if (list.length === 0) {
        toast.error("No workspaces found for this token");
        return;
      }
      setWorkspaces(list);
      setSelectedWorkspaceId(list.length === 1 ? list[0]!.id : null);
      toast.success(`Found ${list.length} workspace${list.length === 1 ? "" : "s"}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveWorkspace() {
    const ws = workspaces?.find((w) => w.id === selectedWorkspaceId);
    if (!ws) {
      toast.error("Select a workspace");
      return;
    }
    setBusy("save");
    try {
      const ok = await patch({
        ...(draftToken.trim() ? { apiToken: draftToken.trim() } : {}),
        apiWorkspaceId: ws.id,
        apiWorkspaceSubdomain: ws.subdomain,
        apiWorkspaceName: ws.name,
      });
      if (ok) {
        setDraftToken("");
        setWorkspaces(null);
        toast.success(`Connected to ${ws.name}`);
      }
    } finally {
      setBusy(null);
    }
  }

  async function testConnection() {
    setBusy("test");
    try {
      const res = await fetch("/api/v1/admin/clickfunnels/products?refresh=1");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Connection test failed");
        return;
      }
      const count = Array.isArray(json.data) ? json.data.length : 0;
      toast.success(`Connection OK — ${count} product${count === 1 ? "" : "s"} found`);
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    setBusy("disconnect");
    try {
      const ok = await patch({ clearApiToken: true });
      if (ok) {
        setWorkspaces(null);
        setDraftToken("");
        toast.success("ClickFunnels API disconnected");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-[var(--theme-primary)]" />
            <DashboardCardTitle>ClickFunnels API</DashboardCardTitle>
          </div>
          <DashboardCardDescription>
            Connect ClickFunnels 2.0 so admins can pick ClickFunnels products on digital
            products. Conversions are matched by ClickFunnels product ID.
          </DashboardCardDescription>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-semibold",
            connected ? "text-[var(--theme-success)]" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              connected ? "bg-[var(--theme-success)]" : "bg-muted-foreground/40",
            )}
          />
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        {connected ? (
          <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Workspace
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {value.apiWorkspaceName || value.apiWorkspaceId}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subdomain
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {value.apiWorkspaceSubdomain}.myclickfunnels.com
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Token
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">{value.apiTokenMasked}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="cf-api-token">API access token</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="cf-api-token"
                type="password"
                value={draftToken}
                onChange={(e) => setDraftToken(e.target.value)}
                placeholder={
                  value.apiTokenConfigured
                    ? "Saved — paste a new token to replace"
                    : "Paste your ClickFunnels API access token"
                }
                className="h-10 rounded-md pl-9 font-mono"
                autoComplete="new-password"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2"
              onClick={() => void connect()}
              disabled={busy !== null}
            >
              <Link2 className="h-4 w-4" />
              {busy === "connect" ? "Connecting..." : "Connect"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Create a token in ClickFunnels under Account → Team → Platform Applications. Only
            the access token is needed; the client ID and secret are not used.
          </p>
        </div>

        {workspaces ? (
          <div className="space-y-2">
            <Label>Workspace</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedWorkspaceId}
                onValueChange={(v) => setSelectedWorkspaceId(v as string)}
              >
                <SelectTrigger className="h-10 min-w-[240px] flex-1 rounded-md">
                  <SelectValue placeholder="Select workspace">
                    {(id: string | null) => {
                      const ws = workspaces.find((w) => w.id === id);
                      return ws ? `${ws.name} (${ws.subdomain})` : "Select workspace";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name} ({ws.subdomain}){ws.teamName ? ` · ${ws.teamName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                className="h-10 rounded-md bg-[var(--theme-primary)] px-5 hover:opacity-90"
                onClick={() => void saveWorkspace()}
                disabled={busy !== null || !selectedWorkspaceId}
              >
                {busy === "save" ? "Saving..." : "Save workspace"}
              </Button>
            </div>
          </div>
        ) : null}

        {connected ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2"
              onClick={() => void testConnection()}
              disabled={busy !== null}
            >
              <PlugZap className="h-4 w-4" />
              {busy === "test" ? "Testing..." : "Test connection"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 text-destructive"
              onClick={() => void disconnect()}
              disabled={busy !== null}
            >
              <Unplug className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
