"use client";

import { useCallback, useEffect, useState } from "react";
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
  createdAt: string;
};

function SubscribersContent() {
  const { search, filterValues } = useEmailModuleFilters();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (search) params.set("search", search);
    if (filterValues.status) params.set("status", filterValues.status);
    fetch(`/api/v1/advertiser/email/contacts?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setContacts(j.data?.items ?? []);
        setTotal(j.data?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, filterValues.status]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageSection title={`All Subscribers (${total})`} icon={Users} gradient="approved">
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
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                  No subscribers found
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((c) => (
                <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium">{c.email}</TableCell>
                  <TableCell>{[c.firstName, c.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</TableCell>
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
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) => setTotal(j.data?.totalContacts ?? 0))
      .catch(() => {});
  }, []);

  return (
    <EmailModuleShell
      title="Subscribers"
      description="Manage your email subscribers and track subscription status."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Subscribers" },
      ]}
      stats={[
        { label: "Subscribed", value: total !== null ? total.toLocaleString() : "—", icon: Users, accent: "green" },
      ]}
      searchPlaceholder="Search by email or name…"
      filters={[
        {
          id: "status",
          label: "Status",
          options: [
            { value: "SUBSCRIBED", label: "Subscribed" },
            { value: "UNSUBSCRIBED", label: "Unsubscribed" },
            { value: "BOUNCED", label: "Bounced" },
          ],
        },
      ]}
    >
      <SubscribersContent />
    </EmailModuleShell>
  );
}
