"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Users } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
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

type Contact = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  sourceCampaignId: string | null;
  createdAt: string;
};

type ListOption = {
  id: string;
  name: string;
  campaignId: string | null;
  subscribers?: number;
  system?: boolean;
};

function SubscribersContent({ listOptions }: { listOptions: ListOption[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const { search, filterValues } = useEmailModuleFilters();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const listId = filterValues.listId || "all";

  useEffect(() => {
    const url = new URL(window.location.href);
    if (listId && listId !== "all") {
      url.searchParams.set("listId", listId);
    } else {
      url.searchParams.delete("listId");
    }
    const next = `${url.pathname}${url.search}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [listId, router]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (search) params.set("search", search);
    if (filterValues.status && filterValues.status !== "all") {
      params.set("status", filterValues.status);
    }
    if (listId && listId !== "all") params.set("listId", listId);
    fetch(`/api/v1/advertiser/email/contacts?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setContacts(j.data?.items ?? []);
        setTotal(j.data?.total ?? 0);
        setSubscribedCount(j.data?.subscribedCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filterValues.status, listId]);

  useEffect(() => {
    load();
  }, [load]);

  const listLabel =
    listOptions.find((l) => l.id === listId)?.name ??
    (listId !== "all" ? "Selected list" : "All subscribers");

  return (
    <PageSection
      title={`${listLabel} (${total})`}
      description="Subscribers come from lead capture on campaigns linked to your lists. There is no manual add."
      icon={Users}
      gradient="approved"
    >
      <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
        Subscribed in view:{" "}
        <span className="font-medium text-slate-900">{subscribedCount.toLocaleString()}</span>
        {" · "}
        <Link href="/advertiser/email/lists" className="text-[var(--theme-primary)] hover:underline">
          Manage lists
        </Link>
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscribed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  No subscribers yet. New leads on a list&apos;s campaign appear here automatically.
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
  );
}

export function SubscribersPanel() {
  const searchParams = useSearchParams();
  const initialListId = searchParams.get("listId") ?? "all";
  const [listOptions, setListOptions] = useState<ListOption[]>([
    { id: "all", name: "All Subscribers", campaignId: null, system: true },
  ]);
  const [subscribedTotal, setSubscribedTotal] = useState<number | null>(null);

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

    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) => setSubscribedTotal(j.data?.totalContacts ?? 0))
      .catch(() => {});
  }, []);

  const listFilterOptions = useMemo(
    () =>
      listOptions
        .filter((l) => l.id !== "all")
        .map((l) => ({ value: l.id, label: l.name })),
    [listOptions],
  );

  return (
    <EmailModuleShell
      title="Subscribers"
      description="Contacts from your lead campaigns. Filter by list to see who will enter list-bound automations."
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
      ]}
      searchPlaceholder="Search by email or name…"
      initialFilterValues={initialListId !== "all" ? { listId: initialListId } : undefined}
      filters={[
        {
          id: "listId",
          label: "List",
          options: listFilterOptions,
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
      <SubscribersContent listOptions={listOptions} />
    </EmailModuleShell>
  );
}
