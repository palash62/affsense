"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import { cn } from "@/lib/utils";
import { readApiErrorMessage } from "@/lib/errors";
import { FunnelCraftTemplateCard } from "@/components/funnel/funnel-craft-template-card";
import { FunnelListToolbar } from "@/components/advertiser/funnel/funnel-list-toolbar";
import { FunnelModuleShell } from "@/components/advertiser/funnel/funnel-module-shell";
import { AdminFunnelTemplateCreateDialog } from "@/components/admin/admin-funnel-template-create-dialog";

const PAGE_SIZES = [15, 25, 50] as const;

type TemplateCard = {
  id: string;
  name: string;
  createdAt: string;
  craftState: CraftSerializedState;
  themeJson: ThemeJson;
  thankYouEnabled?: boolean;
  isPublished?: boolean;
};

export function AdminFunnelTemplatesList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(15);
  const [createOpen, setCreateOpen] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/optin-funnel-templates");
    const body = await res.json().catch(() => ({}));
    setTemplates(body.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  async function createTemplate(input: { name: string; sourceTemplateId?: string }) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/optin-funnel-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(readApiErrorMessage(body, "Failed to create template.", res.status));
        return;
      }
      const data = body?.data;
      if (!data?.id) {
        toast.error(readApiErrorMessage(body, "Failed to create template.", res.status));
        return;
      }
      setCreateOpen(false);
      toast.success("Template created.");
      router.push(`/admin/funnel-templates/${data.id}`);
    } catch {
      toast.error("Failed to create template. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTemplate(template: TemplateCard) {
    setDuplicatingId(template.id);
    try {
      const res = await fetch(`/api/v1/admin/optin-funnel-templates/${template.id}/duplicate`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(readApiErrorMessage(body, "Failed to duplicate template.", res.status));
        return;
      }
      const data = body?.data;
      if (!data?.id) {
        toast.error(readApiErrorMessage(body, "Failed to duplicate template.", res.status));
        return;
      }
      toast.success("Template duplicated.");
      router.push(`/admin/funnel-templates/${data.id}`);
    } catch {
      toast.error("Failed to duplicate template. Check your connection and try again.");
    } finally {
      setDuplicatingId(null);
    }
  }

  async function deleteTemplate(template: TemplateCard) {
    if (!confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    setDeletingId(template.id);
    const res = await fetch(`/api/v1/admin/optin-funnel-templates/${template.id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error?.message ?? "Failed to delete template.");
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    toast.success("Template deleted.");
  }

  function renderTemplateActions(template: TemplateCard) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "secondary", size: "icon" }),
            "h-8 w-8 bg-white/95 text-muted-foreground shadow-sm hover:bg-white",
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => router.push(`/admin/funnel-templates/${template.id}`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Open template
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              window.open(`/admin/funnel-templates/${template.id}/preview?frame=1&bp=desktop`, "_blank", "noopener,noreferrer")
            }
          >
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={duplicatingId === template.id}
            onClick={() => void duplicateTemplate(template)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            disabled={deletingId === template.id}
            onClick={() => void deleteTemplate(template)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <FunnelModuleShell
      title="Funnel Templates"
      description="Create and manage system funnel templates used by advertisers when creating new funnels."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled>
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button disabled={saving} onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New template
          </Button>
        </div>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <FunnelListToolbar
          search={search}
          searchPlaceholder="Search for templates"
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />

        {loading ? (
          <div className="px-6 py-12 text-sm text-muted-foreground">Loading templates...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {templates.length === 0 ? "No templates yet" : "No templates match your search"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {templates.length === 0
                ? "Create your first template to make reusable funnel layouts for advertisers."
                : "Try a different search term."}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((template) => (
              <FunnelCraftTemplateCard
                key={template.id}
                id={template.id}
                name={template.name}
                craftState={template.craftState}
                themeJson={template.themeJson}
                thankYouEnabled={template.thankYouEnabled}
                isPublished={template.isPublished}
                createdAt={template.createdAt}
                variant="admin"
                actions={renderTemplateActions(template)}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v) as (typeof PAGE_SIZES)[number]);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span>
              {rangeStart} – {rangeEnd} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-md border border-border px-2 text-foreground">
                {currentPage}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <AdminFunnelTemplateCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={saving}
        onCreate={createTemplate}
      />
    </FunnelModuleShell>
  );
}
