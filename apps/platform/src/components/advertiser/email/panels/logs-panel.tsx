"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
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
  SENT: "default",
  DELIVERED: "default",
  QUEUED: "secondary",
  FAILED: "destructive",
};

type SendRow = {
  id: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  hasOpen: boolean;
  hasClick: boolean;
  contact: { email: string; firstName: string | null; lastName: string | null };
  template: { subject: string };
  automation: { name: string } | null;
};

function LogsContent() {
  const { search, filterValues } = useEmailModuleFilters();
  const [rows, setRows] = useState<SendRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: "1", limit: "50" });
    if (filterValues.status) params.set("status", filterValues.status);
    fetch(`/api/v1/advertiser/email/sends?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data?.items ?? []);
        setTotal(j.data?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterValues.status]);

  useEffect(() => { load(); }, [load]);

  const filtered = search
    ? rows.filter(
        (r) =>
          r.contact.email.toLowerCase().includes(search.toLowerCase()) ||
          r.template.subject.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  return (
    <PageSection title={`Delivery History (${total})`} icon={ScrollText} gradient="leads">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">Loading...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  No email sends found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium">{row.contact.email}</TableCell>
                  <TableCell className="text-slate-600">{row.template.subject}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status.toLowerCase()}</Badge>
                  </TableCell>
                  <TableCell>{row.hasOpen ? "Yes" : "—"}</TableCell>
                  <TableCell>{row.hasClick ? "Yes" : "—"}</TableCell>
                  <TableCell className="text-slate-500">
                    {row.sentAt ? new Date(row.sentAt).toLocaleString() : "—"}
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

export function LogsPanel() {
  return (
    <EmailModuleShell
      title="Email Logs"
      description="View delivery history and status for all sent emails."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Email Logs" },
      ]}
      searchPlaceholder="Search by recipient or subject…"
      filters={[
        {
          id: "status",
          label: "Status",
          options: [
            { value: "SENT", label: "Sent" },
            { value: "DELIVERED", label: "Delivered" },
            { value: "QUEUED", label: "Queued" },
            { value: "FAILED", label: "Failed" },
          ],
        },
      ]}
    >
      <LogsContent />
    </EmailModuleShell>
  );
}
