"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { List, Loader2, Pencil, Plus, Trash2, Users, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

type ListRow = {
  id: string;
  name: string;
  campaignIds: string[];
  campaigns: { id: string; name: string }[];
  campaignId: string | null;
  campaignName: string | null;
  subscribers: number;
  system?: boolean;
};

type CampaignOption = { id: string; name: string; contactCount: number };

type FormState = {
  name: string;
  campaignIds: string[];
};

const emptyForm: FormState = { name: "", campaignIds: [] };

export function ListsPanel() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editBaselineCampaignIds, setEditBaselineCampaignIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listsRes, campaignsRes] = await Promise.all([
        fetch("/api/v1/advertiser/email/lists"),
        fetch("/api/v1/advertiser/email/campaigns"),
      ]);
      const listsJson = await listsRes.json();
      const campaignsJson = await campaignsRes.json();
      setRows(listsJson.data ?? []);
      setCampaigns(
        (campaignsJson.data ?? []).map(
          (c: { id: string; name: string; contactCount?: number }) => ({
            id: c.id,
            name: c.name,
            contactCount: c.contactCount ?? 0,
          }),
        ),
      );
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = rows.find((r) => r.id === "all")?.subscribers ?? 0;
  const managedLists = rows.filter((r) => !r.system);
  const listCount = managedLists.length;

  const campaignOptions = useMemo(() => {
    const usedByOthers = new Set(
      managedLists
        .filter((r) => r.id !== editingId)
        .flatMap((r) =>
          r.campaignIds.length > 0
            ? r.campaignIds
            : r.campaigns.map((c) => c.id),
        ),
    );
    return campaigns.filter(
      (c) =>
        !usedByOthers.has(c.id) ||
        editBaselineCampaignIds.includes(c.id) ||
        form.campaignIds.includes(c.id),
    );
  }, [campaigns, managedLists, editingId, editBaselineCampaignIds, form.campaignIds]);

  const selectedContactCount = useMemo(
    () =>
      form.campaignIds.reduce((sum, id) => {
        const campaign = campaigns.find((c) => c.id === id);
        return sum + (campaign?.contactCount ?? 0);
      }, 0),
    [form.campaignIds, campaigns],
  );

  function toggleCampaign(campaignId: string, checked: boolean) {
    setForm((f) => ({
      ...f,
      campaignIds: checked
        ? [...new Set([...f.campaignIds, campaignId])]
        : f.campaignIds.filter((id) => id !== campaignId),
    }));
  }

  function openCreate() {
    setEditingId(null);
    setEditBaselineCampaignIds([]);
    setForm(emptyForm);
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(row: ListRow) {
    const baseline =
      row.campaignIds.length > 0
        ? row.campaignIds
        : row.campaigns.map((c) => c.id);
    setEditingId(row.id);
    setEditBaselineCampaignIds(baseline);
    setForm({
      name: row.name,
      campaignIds: baseline,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.campaignIds.length === 0) {
      setError("Name and at least one campaign are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        editingId
          ? `/api/v1/advertiser/email/lists/${editingId}`
          : "/api/v1/advertiser/email/lists",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            campaignIds: form.campaignIds,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to save list");
        return;
      }
      setDialogOpen(false);
      await load();
    } catch {
      setError("Unable to save list");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ListRow) {
    if (row.system) return;
    if (!window.confirm(`Delete list “${row.name}”? Subscribers stay in your account.`)) {
      return;
    }
    setDeletingId(row.id);
    try {
      const res = await fetch(`/api/v1/advertiser/email/lists/${row.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        window.alert(json?.error?.message ?? "Unable to delete list");
        return;
      }
      await load();
    } catch {
      window.alert("Unable to delete list");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <EmailModuleShell
      title="Lists"
      description="Create named lists tied to one or more lead campaigns. Subscribers from those campaigns feed the list."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Lists" },
      ]}
      stats={[
        { label: "Total Lists", value: listCount.toLocaleString(), icon: List, accent: "purple" },
        { label: "Total Subscribers", value: total.toLocaleString(), icon: List, accent: "green" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Subscriber Lists" icon={List} gradient="leads">
        <div className="flex items-center justify-end border-b border-slate-100 px-6 py-3">
          <Button
            type="button"
            onClick={openCreate}
            className="h-9 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
            disabled={campaigns.length === 0}
          >
            <Plus className="h-4 w-4" />
            Create list
          </Button>
        </div>
        {campaigns.length === 0 && !loading ? (
          <p className="px-6 py-3 text-sm text-amber-700">
            Create a lead campaign first, then you can attach an email list to it.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List Name</TableHead>
                <TableHead>Campaigns</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-40 px-6 text-center">
                    <p className="text-slate-600">No lists yet.</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Create a list tied to one or more lead campaigns, then bind an automation to it.
                      Subscribers appear when leads are captured on those campaigns.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button type="button" onClick={openCreate} disabled={campaigns.length === 0}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create list
                      </Button>
                      <ButtonLink href="/advertiser/email/automations/new" variant="outline">
                        <Zap className="mr-2 h-4 w-4" />
                        Create automation
                      </ButtonLink>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((list) => (
                  <TableRow key={list.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium">
                      {list.system ? (
                        list.name
                      ) : (
                        <Link
                          href={`/advertiser/email/subscribers?listId=${list.id}`}
                          className="text-[var(--theme-primary)] hover:underline"
                        >
                          {list.name}
                        </Link>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {list.system ? (
                        "—"
                      ) : list.campaigns.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {list.campaigns.map((c) => (
                            <span
                              key={c.id}
                              className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{list.subscribers.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      {list.system ? (
                        <ButtonLink
                          href="/advertiser/email/subscribers"
                          variant="ghost"
                          className="h-8 gap-1.5 px-2 text-xs"
                        >
                          <Users className="h-3.5 w-3.5" />
                          View
                        </ButtonLink>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <ButtonLink
                            href={`/advertiser/email/subscribers?listId=${list.id}`}
                            variant="ghost"
                            className="h-8 gap-1.5 px-2 text-xs"
                            aria-label={`View subscribers in ${list.name}`}
                          >
                            <Users className="h-3.5 w-3.5" />
                            View
                          </ButtonLink>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={`Edit ${list.name}`}
                            onClick={() => openEdit(list)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            aria-label={`Delete ${list.name}`}
                            disabled={deletingId === list.id}
                            onClick={() => void handleDelete(list)}
                          >
                            {deletingId === list.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setError(null);
            setEditingId(null);
            setEditBaselineCampaignIds([]);
            setForm(emptyForm);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit list" : "Create list"}</DialogTitle>
              <DialogDescription>
                {editingId
                  ? "Update the list name or change which campaigns feed it. Uncheck campaigns to remove them from this list."
                  : "Choose one or more lead campaigns whose subscribers feed this list."}
              </DialogDescription>
            </DialogHeader>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="list-name">List name</Label>
              <Input
                id="list-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. OLSP warm leads"
                required
                minLength={2}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Campaigns</Label>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {campaignOptions.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    All campaigns already have a list, or you have no campaigns yet.
                  </p>
                ) : (
                  campaignOptions.map((c) => {
                    const checked = form.campaignIds.includes(c.id);
                    const inputId = `list-campaign-${c.id}`;
                    return (
                      <div
                        key={c.id}
                        className="flex items-start gap-3 rounded-md px-1 py-1.5 hover:bg-slate-50"
                      >
                        <Checkbox
                          id={inputId}
                          checked={checked}
                          onCheckedChange={(value) =>
                            toggleCampaign(c.id, value === true)
                          }
                          disabled={saving}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={inputId}
                          className="min-w-0 flex-1 cursor-pointer font-normal"
                        >
                          <span className="block text-sm font-medium text-slate-900">
                            {c.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {c.contactCount.toLocaleString()} subscribed contacts
                          </span>
                        </Label>
                      </div>
                    );
                  })
                )}
              </div>
              {editingId ? (
                <p className="text-xs text-slate-500">
                  Uncheck a campaign to remove it from this list. At least one campaign is
                  required.
                </p>
              ) : null}
              {form.campaignIds.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Selected campaigns have{" "}
                  {selectedContactCount.toLocaleString()} subscribed contacts combined.
                </p>
              ) : null}
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
              <Button
                type="submit"
                disabled={saving || form.campaignIds.length === 0}
                className="gap-2 bg-[var(--theme-primary)] hover:opacity-90"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving..." : editingId ? "Save changes" : "Create list"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </EmailModuleShell>
  );
}
