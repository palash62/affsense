"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  MailOpen,
  MousePointerClick,
  Plus,
  Send,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUserDateTime } from "@/lib/user-timezone";
import { EmailModuleShell } from "../email-module-shell";

type AudienceType = "LIST" | "TAGS";

type BroadcastRow = {
  id: string;
  name: string;
  audienceType: AudienceType;
  listName: string | null;
  tagIds: string[];
  status: string;
  scheduledAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  template: { id: string; name: string; subject: string };
  createdAt: string;
};

type TagOption = { id: string; name: string };

type BroadcastStats = {
  broadcastId: string;
  name: string;
  status: string;
  recipientCount: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
  opens: number;
  clicks: number;
  complaints: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
};

function statusLabel(row: BroadcastRow) {
  if (row.status === "DRAFT") return "draft";
  if (
    row.status === "QUEUED" &&
    row.scheduledAt &&
    new Date(row.scheduledAt).getTime() > Date.now()
  ) {
    return "scheduled";
  }
  if (row.status === "QUEUED") return "queued";
  return row.status.toLowerCase();
}

function statusVariant(
  label: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (label === "sent") return "default";
  if (label === "failed") return "destructive";
  if (label === "draft") return "outline";
  return "secondary";
}

function isEditable(row: BroadcastRow) {
  return (
    row.status === "DRAFT" ||
    row.status === "QUEUED" ||
    (row.status === "FAILED" && row.sentCount === 0)
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Send;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/80 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tracking-tight text-foreground">{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

export function BroadcastsPanel() {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [rows, setRows] = useState<BroadcastRow[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsOpen, setStatsOpen] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [stats, setStats] = useState<BroadcastStats | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const [bRes, tRes] = await Promise.all([
        fetch("/api/v1/advertiser/email/broadcasts", { credentials: "same-origin" }),
        fetch("/api/v1/advertiser/email/tags", { credentials: "same-origin" }),
      ]);
      const [bJson, tJson] = await Promise.all([
        bRes.json().catch(() => null),
        tRes.json().catch(() => null),
      ]);
      setRows((bJson?.data ?? []) as BroadcastRow[]);
      setTags((tJson?.data ?? []) as TagOption[]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasInFlight = useMemo(
    () => rows.some((r) => r.status === "QUEUED" || r.status === "SENDING"),
    [rows],
  );

  useEffect(() => {
    if (!hasInFlight) return;
    const id = window.setInterval(() => {
      void load({ silent: true });
    }, 4000);
    return () => window.clearInterval(id);
  }, [hasInFlight, load]);

  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);

  function audienceLabel(row: BroadcastRow) {
    if (row.audienceType === "LIST") {
      return row.listName ? `List: ${row.listName}` : "List";
    }
    const names = row.tagIds.map((id) => tagNameById.get(id) ?? id.slice(0, 6));
    return names.length ? `Tags: ${names.join(", ")}` : "Tags";
  }

  async function openStats(row: BroadcastRow) {
    setStatsOpen(true);
    setStatsLoading(true);
    setStatsError(null);
    setStats(null);
    try {
      const res = await fetch(`/api/v1/advertiser/email/broadcasts/${row.id}/stats`, {
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        setStatsError(json?.error?.message ?? "Failed to load stats");
        return;
      }
      setStats(json.data as BroadcastStats);
    } catch {
      setStatsError("Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <EmailModuleShell
      title="Broadcasts"
      description="Send one-shot emails to a list or tagged subscribers. Unsubscribe links are added automatically."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Broadcasts" },
      ]}
      stats={[
        {
          label: "Broadcasts",
          value: rows.length.toLocaleString(),
          icon: Send,
          accent: "purple",
        },
        {
          label: "Emails queued/sent",
          value: rows.reduce((s, r) => s + r.recipientCount, 0).toLocaleString(),
          icon: Mail,
          variant: "leads",
        },
      ]}
      showToolbar={false}
    >
      <PageSection title="Broadcast history" icon={Send} gradient="leads">
        <div className="flex items-center justify-end border-b border-border px-6 py-3">
          <ButtonLink
            href="/advertiser/email/broadcasts/new"
            className="h-9 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            New broadcast
          </ButtonLink>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 px-6 text-center">
                    <p className="text-muted-foreground">No broadcasts yet.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Save a draft, schedule for later, or send to a list or tags.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <ButtonLink href="/advertiser/email/broadcasts/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New broadcast
                      </ButtonLink>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const label = statusLabel(row);
                  return (
                    <TableRow key={row.id} className="hover:bg-muted">
                      <TableCell className="font-medium">
                        {isEditable(row) ? (
                          <Link
                            href={`/advertiser/email/broadcasts/${row.id}`}
                            className="text-[var(--theme-primary)] hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void openStats(row)}
                            className="text-left text-[var(--theme-primary)] hover:underline"
                          >
                            {row.name}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {audienceLabel(row)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {row.template.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(label)}>{label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {row.scheduledAt
                          ? formatUserDateTime(
                              row.scheduledAt,
                              timezone,
                              "MMM d, yyyy HH:mm",
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>{row.recipientCount.toLocaleString()}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums text-foreground">
                        {row.sentCount.toLocaleString()}/
                        {row.recipientCount.toLocaleString()}
                        {row.failedCount > 0 ? (
                          <span className="ml-1 text-xs text-red-600">
                            ({row.failedCount} failed)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatUserDateTime(
                          row.createdAt,
                          timezone,
                          "MMM d, yyyy HH:mm",
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <Dialog
        open={statsOpen}
        onOpenChange={(open) => {
          setStatsOpen(open);
          if (!open) {
            setStats(null);
            setStatsError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{stats?.name ?? "Broadcast statistics"}</DialogTitle>
            <DialogDescription>
              Open, click, bounce, and delivery stats for this broadcast.
            </DialogDescription>
          </DialogHeader>
          {statsLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading stats…</p>
          ) : statsError ? (
            <p className="py-8 text-center text-sm text-red-600">{statsError}</p>
          ) : stats ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <StatRow
                icon={Send}
                label="Sent"
                value={stats.sent.toLocaleString()}
                detail={`${stats.recipientCount.toLocaleString()} recipients`}
              />
              <StatRow
                icon={CheckCircle2}
                label="Delivered"
                value={stats.delivered.toLocaleString()}
              />
              <StatRow
                icon={AlertTriangle}
                label="Bounced"
                value={stats.bounced.toLocaleString()}
                detail={`${stats.bounceRate}% bounce rate`}
              />
              <StatRow
                icon={XCircle}
                label="Failed"
                value={stats.failed.toLocaleString()}
              />
              <StatRow
                icon={MailOpen}
                label="Opened"
                value={`${stats.openRate}%`}
                detail={`${stats.opens.toLocaleString()} opens`}
              />
              <StatRow
                icon={MousePointerClick}
                label="Clicked"
                value={`${stats.clickRate}%`}
                detail={`${stats.clicks.toLocaleString()} clicks`}
              />
              <StatRow
                icon={ShieldAlert}
                label="Complaints"
                value={stats.complaints.toLocaleString()}
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </EmailModuleShell>
  );
}
