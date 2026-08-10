"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LayoutTemplate, Plus } from "lucide-react";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import type { OptinFunnelTemplate } from "@/services/optin-funnel.service";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { readApiErrorMessage } from "@/lib/errors";
import { FunnelCraftTemplateCard } from "@/components/funnel/funnel-craft-template-card";
import { FunnelModuleShell } from "./funnel-module-shell";
import { FunnelListToolbar } from "./funnel-list-toolbar";
import { FunnelCard } from "./funnel-card";
import { FunnelCreateDialog } from "./funnel-create-dialog";

const PAGE_SIZES = [15, 25, 50] as const;

function normalizeTemplateCraft(template: OptinFunnelTemplate): OptinFunnelTemplate {
  const raw = template.craftState as unknown;
  if (raw && typeof raw === "object" && "craft" in raw) {
    const nested = (raw as { craft?: CraftSerializedState }).craft;
    if (nested && typeof nested === "object") {
      return { ...template, craftState: nested };
    }
  }
  return template;
}

type FunnelListPanelProps = {
  initialFunnels: SerializedOptinFunnel[];
  initialTemplates: OptinFunnelTemplate[];
};

export function FunnelListPanel({ initialFunnels, initialTemplates }: FunnelListPanelProps) {
  const router = useRouter();
  const [funnels, setFunnels] = useState(initialFunnels);
  const [templates, setTemplates] = useState(() => initialTemplates.map(normalizeTemplateCraft));
  const [templatesLoading, setTemplatesLoading] = useState(initialTemplates.length === 0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(15);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialMode, setCreateInitialMode] = useState<"blank" | "templates">("blank");
  const [createInitialTemplateId, setCreateInitialTemplateId] = useState<string | undefined>();
  const [createInitialName, setCreateInitialName] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (templates.length === 0) {
      setTemplatesLoading(true);
    }
    fetch("/api/v1/advertiser/optin-funnels/templates")
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body || !Array.isArray(body.data)) {
          // Keep SSR / current templates on auth or API errors.
          return;
        }
        setTemplates(body.data.map(normalizeTemplateCraft));
      })
      .catch(() => {
        // Keep any server-prefetched templates on failure.
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return funnels;
    return funnels.filter((f) => f.name.toLowerCase().includes(q) || f.slug.toLowerCase().includes(q));
  }, [funnels, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  async function createFunnel(input: {
    name: string;
    editorType: "BUILDER";
    pageTemplateId?: string;
  }) {
    setLoading(true);
    const res = await fetch("/api/v1/advertiser/optin-funnels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body?.error?.message ?? "Failed to create funnel");
      return;
    }
    const { data } = await res.json();
    setCreateOpen(false);
    router.push(`/advertiser/optin-funnels/${data.id}`);
  }

  function openCreateDialog(options?: {
    mode?: "blank" | "templates";
    templateId?: string;
    name?: string;
  }) {
    setCreateInitialMode(options?.mode ?? "blank");
    setCreateInitialTemplateId(options?.templateId);
    setCreateInitialName(options?.name);
    setCreateOpen(true);
  }

  async function archiveFunnel(id: string) {
    if (!confirm("Archive this funnel?")) return;
    const res = await fetch(`/api/v1/advertiser/optin-funnels/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Archive failed");
      return;
    }
    setFunnels((prev) => prev.filter((f) => f.id !== id));
    toast.success("Funnel archived");
  }

  async function duplicateFunnel(funnel: SerializedOptinFunnel) {
    setDuplicatingId(funnel.id);
    try {
      const res = await fetch(`/api/v1/advertiser/optin-funnels/${funnel.id}/duplicate`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(readApiErrorMessage(body, "Failed to duplicate funnel.", res.status));
        return;
      }
      const data = body?.data;
      if (!data?.id) {
        toast.error(readApiErrorMessage(body, "Failed to duplicate funnel.", res.status));
        return;
      }
      toast.success("Funnel duplicated.");
      router.push(`/advertiser/optin-funnels/${data.id}`);
    } catch {
      toast.error("Failed to duplicate funnel. Check your connection and try again.");
    } finally {
      setDuplicatingId(null);
    }
  }

  return (
    <FunnelModuleShell
      title="Funnels"
      description="Create and manage funnels to generate leads, appointments and receive payments."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled>
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button onClick={() => openCreateDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            New funnel
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-4">
            <h2 className="text-lg font-semibold text-foreground">Template library</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a high-converting layout, then customize it in the funnel builder.
            </p>
          </div>

          {templatesLoading ? (
            <div className="px-6 py-12 text-sm text-muted-foreground">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              No templates available yet. Ask your admin to create funnel templates.
            </div>
          ) : (
            <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => (
                <FunnelCraftTemplateCard
                  key={template.id}
                  id={template.id}
                  name={template.name}
                  craftState={template.craftState}
                  themeJson={template.themeJson}
                  thankYouEnabled={template.thankYouEnabled}
                  createdAt={template.createdAt}
                  variant="advertiser"
                  loading={loading}
                  onUse={() =>
                    openCreateDialog({
                      mode: "templates",
                      templateId: template.id,
                      name: template.name,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your funnels</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Funnels you have created or duplicated from templates.
            </p>
          </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <FunnelListToolbar search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }} />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                <LayoutTemplate className="h-7 w-7 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {funnels.length === 0 ? "No funnels yet" : "No funnels match your search"}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {funnels.length === 0
                  ? "Create your first funnel or pick a template from the library below."
                  : "Try a different search term."}
              </p>
              {funnels.length === 0 && (
                <Button className="mt-6" onClick={() => openCreateDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first funnel
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-5 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((funnel) => (
                <FunnelCard
                  key={funnel.id}
                  funnel={funnel}
                  duplicating={duplicatingId === funnel.id}
                  onDuplicate={() => void duplicateFunnel(funnel)}
                  onArchive={() => void archiveFunnel(funnel.id)}
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
        </section>
      </div>

      <FunnelCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        loading={loading}
        templates={templates}
        initialMode={createInitialMode}
        initialTemplateId={createInitialTemplateId}
        initialName={createInitialName}
        onCreate={createFunnel}
      />
    </FunnelModuleShell>
  );
}
