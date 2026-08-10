"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHero } from "@/components/admin/page-hero";
import {
  AdminTutorialFormDialog,
  type TutorialFormValues,
} from "@/components/admin/admin-tutorial-form-dialog";
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
import type { SerializedTutorial } from "@/services/tutorial.service";

export function AdminTutorialsList() {
  const [tutorials, setTutorials] = useState<SerializedTutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<SerializedTutorial | null>(null);

  async function loadTutorials() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/tutorials");
    const body = await res.json().catch(() => ({}));
    setTutorials(body.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadTutorials();
  }, []);

  function openCreate() {
    setEditingTutorial(null);
    setDialogOpen(true);
  }

  function openEdit(tutorial: SerializedTutorial) {
    setEditingTutorial(tutorial);
    setDialogOpen(true);
  }

  async function handleSubmit(values: TutorialFormValues) {
    setSaving(true);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        youtubeUrl: values.youtubeUrl.trim(),
        thumbnailUrl: values.thumbnailUrl.trim(),
        sortOrder: values.sortOrder,
        isPublished: values.isPublished,
      };

      const res = editingTutorial
        ? await fetch(`/api/v1/admin/tutorials/${editingTutorial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/v1/admin/tutorials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          readApiErrorMessage(body, editingTutorial ? "Failed to update tutorial." : "Failed to add tutorial.", res.status),
        );
      }

      toast.success(editingTutorial ? "Tutorial updated" : "Tutorial added");
      setDialogOpen(false);
      setEditingTutorial(null);
      await loadTutorials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tutorial: SerializedTutorial) {
    if (!window.confirm(`Delete "${tutorial.title}"?`)) return;
    setDeletingId(tutorial.id);
    try {
      const res = await fetch(`/api/v1/admin/tutorials/${tutorial.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to delete tutorial.", res.status));
      }
      toast.success("Tutorial deleted");
      await loadTutorials();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Content"
        title="Tutorials"
        description="Add YouTube tutorial videos for advertisers. Upload a thumbnail, title, and description for each video."
        badge={`${tutorials.length} total`}
      />

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add tutorial
        </Button>
      </div>

      <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm">
        {loading ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">Loading tutorials…</div>
        ) : tutorials.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">No tutorials yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Add your first tutorial video for advertisers.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Thumbnail
                  </TableHead>
                  <TableHead className="h-10 min-w-[180px] px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Title
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Order
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tutorials.map((tutorial) => (
                  <TableRow key={tutorial.id} className="border-border hover:bg-muted/80">
                    <TableCell className="px-4 py-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tutorial.thumbnailUrl}
                        alt=""
                        className="h-14 w-24 rounded-md border border-border object-cover"
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{tutorial.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tutorial.description}</p>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        className={
                          tutorial.isPublished
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-border bg-muted text-muted-foreground"
                        }
                      >
                        {tutorial.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm text-foreground">
                      {tutorial.sortOrder}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(tutorial)}
                          disabled={deletingId === tutorial.id}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void handleDelete(tutorial)}
                          disabled={deletingId === tutorial.id}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AdminTutorialFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        loading={saving}
        tutorial={editingTutorial}
        onSubmit={(values) => void handleSubmit(values)}
      />
    </div>
  );
}
