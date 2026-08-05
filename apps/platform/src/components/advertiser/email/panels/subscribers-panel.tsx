"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, Plus, Tags, Users, X } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useEmailModuleFilters } from "../email-module-filter-context";
import { EmailModuleShell } from "../email-module-shell";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SUBSCRIBED: "default",
  UNSUBSCRIBED: "secondary",
  BOUNCED: "destructive",
  COMPLAINED: "destructive",
};

type ContactTag = {
  id: string;
  name: string;
  color: string | null;
};

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  sourceCampaignId: string | null;
  createdAt: string;
  tags: ContactTag[];
};

type ListOption = {
  id: string;
  name: string;
  campaignId: string | null;
  subscribers?: number;
  system?: boolean;
};

type TagOption = {
  id: string;
  name: string;
  color: string | null;
  contactCount?: number;
};

function SubscribersContent({
  listOptions,
  tagOptions,
  onTagsChanged,
}: {
  listOptions: ListOption[];
  tagOptions: TagOption[];
  onTagsChanged: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const { search, filterValues } = useEmailModuleFilters();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [manageContact, setManageContact] = useState<Contact | null>(null);
  const [pendingTagId, setPendingTagId] = useState<string | null>(null);

  const listId = filterValues.listId || "all";
  const tagId = filterValues.tagId || "all";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (listId && listId !== "all") {
      url.searchParams.set("listId", listId);
    } else {
      url.searchParams.delete("listId");
    }
    if (tagId && tagId !== "all") {
      url.searchParams.set("tagId", tagId);
    } else {
      url.searchParams.delete("tagId");
    }
    const next = `${url.pathname}${url.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [listId, tagId, router]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (search) params.set("search", search);
    if (filterValues.status && filterValues.status !== "all") {
      params.set("status", filterValues.status);
    }
    if (listId && listId !== "all") params.set("listId", listId);
    if (tagId && tagId !== "all") params.set("tagId", tagId);
    fetch(`/api/v1/advertiser/email/contacts?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setContacts(
          (j.data?.items ?? []).map((c: Contact) => ({
            ...c,
            tags: c.tags ?? [],
          })),
        );
        setTotal(j.data?.total ?? 0);
        setSubscribedCount(j.data?.subscribedCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filterValues.status, listId, tagId]);

  useEffect(() => {
    load();
  }, [load]);

  const listLabel =
    listOptions.find((l) => l.id === listId)?.name ??
    (listId !== "all" ? "Selected list" : "All subscribers");
  const tagLabel =
    tagOptions.find((t) => t.id === tagId)?.name ??
    (tagId !== "all" ? "Selected tag" : null);

  const titleParts = [listLabel, tagLabel ? `tagged ${tagLabel}` : null]
    .filter(Boolean)
    .join(" · ");

  async function attachTag(contact: Contact, nextTagId: string) {
    setPendingTagId(nextTagId);
    try {
      const res = await fetch(
        `/api/v1/advertiser/email/tags/${nextTagId}/contacts/${contact.id}`,
        { method: "POST" },
      );
      if (!res.ok) {
        const json = await res.json();
        window.alert(json?.error?.message ?? "Unable to add tag");
        return;
      }
      const tag = tagOptions.find((t) => t.id === nextTagId);
      if (tag) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contact.id && !c.tags.some((t) => t.id === tag.id)
              ? {
                  ...c,
                  tags: [
                    ...c.tags,
                    { id: tag.id, name: tag.name, color: tag.color },
                  ],
                }
              : c,
          ),
        );
        setManageContact((prev) =>
          prev && prev.id === contact.id && !prev.tags.some((t) => t.id === tag.id)
            ? {
                ...prev,
                tags: [
                  ...prev.tags,
                  { id: tag.id, name: tag.name, color: tag.color },
                ],
              }
            : prev,
        );
      }
      onTagsChanged();
    } catch {
      window.alert("Unable to add tag");
    } finally {
      setPendingTagId(null);
    }
  }

  async function detachTag(contact: Contact, removeTagId: string) {
    setPendingTagId(removeTagId);
    try {
      const res = await fetch(
        `/api/v1/advertiser/email/tags/${removeTagId}/contacts/${contact.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json();
        window.alert(json?.error?.message ?? "Unable to remove tag");
        return;
      }
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, tags: c.tags.filter((t) => t.id !== removeTagId) }
            : c,
        ),
      );
      setManageContact((prev) =>
        prev && prev.id === contact.id
          ? { ...prev, tags: prev.tags.filter((t) => t.id !== removeTagId) }
          : prev,
      );
      onTagsChanged();
      if (tagId === removeTagId) {
        load();
      }
    } catch {
      window.alert("Unable to remove tag");
    } finally {
      setPendingTagId(null);
    }
  }

  const availableToAdd = manageContact
    ? tagOptions.filter((t) => !manageContact.tags.some((ct) => ct.id === t.id))
    : [];

  return (
    <>
      <PageSection
        title={`${titleParts} (${total})`}
        description="Subscribers come from lead capture on campaigns linked to your lists. Apply tags to organize and filter contacts."
        icon={Users}
        gradient="approved"
      >
        <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
          Subscribed in view:{" "}
          <span className="font-medium text-slate-900">
            {subscribedCount.toLocaleString()}
          </span>
          {" · "}
          <Link
            href="/advertiser/email/lists"
            className="text-[var(--theme-primary)] hover:underline"
          >
            Manage lists
          </Link>
          {" · "}
          <Link
            href="/advertiser/email/tags"
            className="text-[var(--theme-primary)] hover:underline"
          >
            Manage tags
          </Link>
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Subscribed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : contacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    No subscribers yet. New leads on a list&apos;s campaign appear here
                    automatically.
                  </TableCell>
                </TableRow>
              ) : (
                contacts.map((c) => (
                  <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium">{c.email}</TableCell>
                    <TableCell>
                      {[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[220px] flex-wrap items-center gap-1">
                        {c.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                          >
                            <span
                              className="inline-block size-1.5 rounded-full"
                              style={{ backgroundColor: tag.color ?? "#334155" }}
                            />
                            {tag.name}
                          </span>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-1.5 text-xs text-slate-500"
                          onClick={() => setManageContact(c)}
                        >
                          <Plus className="size-3" />
                          Tags
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                        {c.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {formatUserDateTime(c.createdAt, timezone, "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>

      <Dialog
        open={Boolean(manageContact)}
        onOpenChange={(open) => {
          if (!open) setManageContact(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>
              {manageContact?.email ?? "Subscriber"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Applied
              </p>
              {manageContact && manageContact.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {manageContact.tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={pendingTagId === tag.id}
                      onClick={() => void detachTag(manageContact, tag.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-red-200 hover:bg-red-50"
                    >
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: tag.color ?? "#334155" }}
                      />
                      {tag.name}
                      {pendingTagId === tag.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <X className="size-3 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No tags on this subscriber.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Add tag
              </p>
              {tagOptions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No tags yet.{" "}
                  <Link
                    href="/advertiser/email/tags"
                    className="text-[var(--theme-primary)] hover:underline"
                  >
                    Create a tag
                  </Link>
                  .
                </p>
              ) : availableToAdd.length === 0 ? (
                <p className="text-sm text-slate-500">All tags are already applied.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {availableToAdd.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={pendingTagId === tag.id}
                      onClick={() =>
                        manageContact && void attachTag(manageContact, tag.id)
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary-soft)]"
                    >
                      <span
                        className="inline-block size-1.5 rounded-full"
                        style={{ backgroundColor: tag.color ?? "#334155" }}
                      />
                      {tag.name}
                      {pendingTagId === tag.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Plus className="size-3 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageContact(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SubscribersPanel() {
  const searchParams = useSearchParams();
  const initialListId = searchParams.get("listId") ?? "all";
  const initialTagId = searchParams.get("tagId") ?? "all";
  const [listOptions, setListOptions] = useState<ListOption[]>([
    { id: "all", name: "All Subscribers", campaignId: null, system: true },
  ]);
  const [tagOptions, setTagOptions] = useState<TagOption[]>([]);
  const [subscribedTotal, setSubscribedTotal] = useState<number | null>(null);

  const loadTags = useCallback(() => {
    fetch("/api/v1/advertiser/email/tags")
      .then((r) => r.json())
      .then((j) => setTagOptions(j.data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/lists")
      .then((r) => r.json())
      .then((j) => {
        const rows = (j.data ?? []) as ListOption[];
        setListOptions(
          rows.length
            ? rows
            : [{ id: "all", name: "All Subscribers", campaignId: null, system: true }],
        );
      })
      .catch(() => {});

    loadTags();

    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) => setSubscribedTotal(j.data?.totalContacts ?? 0))
      .catch(() => {});
  }, [loadTags]);

  const listFilterOptions = useMemo(
    () =>
      listOptions
        .filter((l) => l.id !== "all")
        .map((l) => ({ value: l.id, label: l.name })),
    [listOptions],
  );

  const tagFilterOptions = useMemo(
    () => tagOptions.map((t) => ({ value: t.id, label: t.name })),
    [tagOptions],
  );

  const initialFilters: Record<string, string> = {};
  if (initialListId !== "all") initialFilters.listId = initialListId;
  if (initialTagId !== "all") initialFilters.tagId = initialTagId;

  return (
    <EmailModuleShell
      title="Subscribers"
      description="Contacts from your lead campaigns. Filter by list or tag; apply tags from each row."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Subscribers" },
      ]}
      stats={[
        {
          label: "Subscribed",
          value: subscribedTotal !== null ? subscribedTotal.toLocaleString() : "—",
          icon: Users,
          accent: "green",
        },
        {
          label: "Tags",
          value: tagOptions.length.toLocaleString(),
          icon: Tags,
          accent: "purple",
        },
      ]}
      searchPlaceholder="Search by email or name…"
      initialFilterValues={
        Object.keys(initialFilters).length ? initialFilters : undefined
      }
      filters={[
        {
          id: "listId",
          label: "List",
          options: listFilterOptions,
        },
        {
          id: "tagId",
          label: "Tag",
          options: tagFilterOptions,
        },
        {
          id: "status",
          label: "Status",
          options: [
            { value: "SUBSCRIBED", label: "Subscribed" },
            { value: "UNSUBSCRIBED", label: "Unsubscribed" },
            { value: "BOUNCED", label: "Bounced" },
            { value: "COMPLAINED", label: "Complained" },
          ],
        },
      ]}
    >
      <SubscribersContent
        listOptions={listOptions}
        tagOptions={tagOptions}
        onTagsChanged={loadTags}
      />
    </EmailModuleShell>
  );
}
