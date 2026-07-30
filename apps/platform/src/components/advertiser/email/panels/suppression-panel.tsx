"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useEmailModuleFilters } from "../email-module-filter-context";
import { EmailModuleShell } from "../email-module-shell";

type Contact = {
  id: string;
  email: string;
  status: string;
  unsubscribedAt: string | null;
  createdAt: string;
};

function SuppressionTable({ rows }: { rows: Contact[] }) {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-slate-50">
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell className="text-slate-600">{row.status.toLowerCase()}</TableCell>
                <TableCell className="text-slate-500">
                  {formatUserDateTime(row.unsubscribedAt ?? row.createdAt, timezone, "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SuppressionContent() {
  const { search } = useEmailModuleFilters();
  const [bounced, setBounced] = useState<Contact[]>([]);
  const [complained, setComplained] = useState<Contact[]>([]);
  const [unsubscribed, setUnsubscribed] = useState<Contact[]>([]);

  const load = useCallback(() => {
    const fetchStatus = (status: string) =>
      fetch(`/api/v1/advertiser/email/contacts?status=${status}&limit=100`)
        .then((r) => r.json())
        .then((j) => j.data?.items ?? []);

    Promise.all([
      fetchStatus("BOUNCED"),
      fetchStatus("COMPLAINED"),
      fetchStatus("UNSUBSCRIBED"),
    ]).then(([b, c, u]) => {
      setBounced(b);
      setComplained(c);
      setUnsubscribed(u);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const filterBySearch = (rows: Contact[]) =>
    search
      ? rows.filter((r) => r.email.toLowerCase().includes(search.toLowerCase()))
      : rows;

  return (
    <PageSection title="Suppressed Contacts" icon={AlertTriangle} gradient="approved">
      <Tabs defaultValue="bounced" className="px-6 pb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="bounced">Bounced ({bounced.length})</TabsTrigger>
          <TabsTrigger value="complaints">Complaints ({complained.length})</TabsTrigger>
          <TabsTrigger value="unsubscribed">Unsubscribed ({unsubscribed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="bounced">
          <SuppressionTable rows={filterBySearch(bounced)} />
        </TabsContent>
        <TabsContent value="complaints">
          <SuppressionTable rows={filterBySearch(complained)} />
        </TabsContent>
        <TabsContent value="unsubscribed">
          <SuppressionTable rows={filterBySearch(unsubscribed)} />
        </TabsContent>
      </Tabs>
    </PageSection>
  );
}

export function SuppressionPanel() {
  const [counts, setCounts] = useState<{ bounced: number; complained: number; unsubscribed: number } | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) =>
        setCounts({
          bounced: j.data?.bounced ?? 0,
          complained: j.data?.complained ?? 0,
          unsubscribed: j.data?.unsubscribed ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <EmailModuleShell
      title="Suppression List"
      description="Manage bounced addresses, spam complaints, and unsubscribed contacts."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Suppression List" },
      ]}
      stats={[
        { label: "Bounced", value: counts ? counts.bounced.toLocaleString() : "—", icon: AlertTriangle, accent: "red" },
        { label: "Complaints", value: counts ? counts.complained.toLocaleString() : "—", icon: AlertTriangle, accent: "orange" },
        { label: "Unsubscribed", value: counts ? counts.unsubscribed.toLocaleString() : "—", icon: AlertTriangle, accent: "purple" },
      ]}
      searchPlaceholder="Search suppressed emails…"
    >
      <SuppressionContent />
    </EmailModuleShell>
  );
}
