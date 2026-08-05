"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Plus, Tags, Trash2, Users } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailModuleShell } from "../email-module-shell";

type TagRow = {
  id: string;
  name: string;
  color: string | null;
  contactCount: number;
  createdAt: string;
};

const TAG_COLORS = [
  { value: "#0f766e", label: "Teal" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#b45309", label: "Amber" },
  { value: "#be123c", label: "Rose" },
  { value: "#5b21b6", label: "Violet" },
  { value: "#334155", label: "Slate" },
];

export function TagsPanel() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0].value);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advertiser/email/tags");
      const json = await res.json();
      setRows(json.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setColor(TAG_COLORS[0].value);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(row: TagRow) {
    setEditingId(row.id);
    setName(row.name);
    setColor(row.color ?? TAG_COLORS[0].value);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editingId
          ? `/api/v1/advertiser/email/tags/${editingId}`
          : "/api/v1/advertiser/email/tags",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), color }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to save tag");
        return;
      }
      setDialogOpen(false);
      await load();
    } catch {
      setError("Unable to save tag");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: TagRow) {
    if (
      !window.confirm(
        `Delete tag “${row.name}”? It will be removed from all subscribers.`,
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/v1/advertiser/email/tags/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        window.alert(json?.error?.message ?? "Unable to delete tag");
        return;
      }
      await load();
    } catch {
      window.alert("Unable to delete tag");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <EmailModuleShell
      title="Tags"
      description="Label subscribers for flexible filtering. Tags are separate from campaign lists."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Tags" },
      ]}
      stats={[
        {
          label: "Tags",
          value: rows.length.toLocaleString(),
          icon: Tags,
          accent: "purple",
        },
      ]}
      showToolbar={false}
    >
      <PageSection title="Subscriber Tags" icon={Tags} gradient="revenue">
        <div className="flex items-center justify-end border-b border-slate-100 px-6 py-3">
          <Button
            type="button"
            onClick={openCreate}
            className="h-9 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create tag
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-40 px-6 text-center">
                    <p className="text-slate-600">No tags yet.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create a tag, then apply it to subscribers from the Subscribers page.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <Button type="button" onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create tag
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((tag) => (
                  <TableRow key={tag.id} className="transition-colors hover:bg-slate-50">
                    <TableCell>
                      <Link
                        href={`/advertiser/email/subscribers?tagId=${tag.id}`}
                        className="inline-flex items-center gap-2 font-medium text-[var(--theme-primary)] hover:underline"
                      >
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color ?? "#334155" }}
                          aria-hidden
                        />
                        {tag.name}
                      </Link>
                    </TableCell>
                    <TableCell>{tag.contactCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ButtonLink
                          href={`/advertiser/email/subscribers?tagId=${tag.id}`}
                          variant="ghost"
                          className="h-8 gap-1.5 px-2 text-xs"
                          aria-label={`View subscribers with ${tag.name}`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          View
                        </ButtonLink>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          aria-label={`Edit ${tag.name}`}
                          onClick={() => openEdit(tag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          aria-label={`Delete ${tag.name}`}
                          disabled={deletingId === tag.id}
                          onClick={() => void handleDelete(tag)}
                        >
                          {deletingId === tag.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={(e) => void handleSave(e)}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit tag" : "Create tag"}</DialogTitle>
              <DialogDescription>
                Use short labels such as VIP or webinar so you can filter subscribers later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  className="mt-1.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. VIP"
                  maxLength={40}
                  autoFocus
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onClick={() => setColor(c.value)}
                      className={`size-8 rounded-full border-2 transition ${
                        color === c.value
                          ? "border-slate-900 ring-2 ring-slate-300"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  "Save"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </EmailModuleShell>
  );
}
