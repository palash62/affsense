"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { readApiErrorMessage } from "@/lib/errors";
import type { SerializedAnnouncement } from "@/services/announcement.service";
import {
  AnnouncementFormDialog,
  type AnnouncementFormValues,
} from "./announcement-form-dialog";
import { ANNOUNCEMENT_TONE_STYLES, formatAnnouncementDate } from "@/components/announcements/announcements-feed";
import { cn } from "@/lib/utils";

const AUDIENCE_LABEL: Record<SerializedAnnouncement["audience"], string> = {
  ADVERTISER: "Advertisers",
  PUBLISHER: "Affiliates",
  BOTH: "Both",
};

export function AdminAnnouncementsPage() {
  const [items, setItems] = useState<SerializedAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SerializedAnnouncement | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/announcements");
    const body = await res.json().catch(() => ({}));
    setItems(body.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(values: AnnouncementFormValues) {
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        body: values.body.trim(),
        iconKey: values.iconKey,
        audience: values.audience,
        tone: values.tone,
        status: values.status,
      };
      const res = editing
        ? await fetch(`/api/v1/admin/announcements/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/admin/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          readApiErrorMessage(body, editing ? "Failed to update announcement." : "Failed to create announcement.", res.status),
        );
      }
      toast.success(editing ? "Announcement updated" : "Announcement created");
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(item: SerializedAnnouncement) {
    const next = item.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    const res = await fetch(`/api/v1/admin/announcements/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(readApiErrorMessage(body, "Failed to update status.", res.status));
      return;
    }
    toast.success(next === "PUBLISHED" ? "Published" : "Moved to draft");
    await load();
  }

  async function handleDelete(item: SerializedAnnouncement) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/v1/admin/announcements/${item.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to delete announcement.", res.status));
      }
      toast.success("Announcement deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button
          className="rounded-xl"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New announcement
        </Button>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading announcements…</div>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No announcements yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a post to show it on advertiser and affiliate dashboards.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/60 hover:bg-transparent">
                  <TableHead className="h-11 px-6 text-muted-foreground">Announcement</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Audience</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Color</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Date</TableHead>
                  <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const tone = ANNOUNCEMENT_TONE_STYLES[item.tone];
                  return (
                    <TableRow key={item.id} className="border-border hover:bg-muted/40">
                      <TableCell className="px-6 py-4">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="outline">{AUDIENCE_LABEL[item.audience]}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span className={cn("h-4 w-4 rounded-md", tone.swatchBg, "ring-1 ring-black/5")} />
                          {tone.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge
                          className={
                            item.status === "PUBLISHED"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-border bg-muted text-muted-foreground"
                          }
                        >
                          {item.status === "PUBLISHED" ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatAnnouncementDate(item.publishedAt ?? item.createdAt)}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => togglePublish(item)}
                            disabled={deletingId === item.id}
                          >
                            {item.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg"
                            onClick={() => {
                              setEditing(item);
                              setDialogOpen(true);
                            }}
                            disabled={deletingId === item.id}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg text-red-600 hover:text-red-700"
                            onClick={() => void handleDelete(item)}
                            disabled={deletingId === item.id}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AnnouncementFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        loading={saving}
        announcement={editing}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </div>
  );
}
