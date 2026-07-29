"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmailModuleShell } from "../email-module-shell";

type ListRow = { id: string; name: string; subscribers: number };

export function ListsPanel() {
  const [rows, setRows] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/contacts/lists")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const total = rows.find((r) => r.id === "all")?.subscribers ?? 0;

  return (
    <EmailModuleShell
      title="Lists"
      description="Subscriber lists organized by the lead campaign they came from."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Lists" },
      ]}
      stats={[
        { label: "Total Lists", value: rows.length.toLocaleString(), icon: List, accent: "purple" },
        { label: "Total Subscribers", value: total.toLocaleString(), icon: List, accent: "green" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Subscriber Lists" icon={List} gradient="leads">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>List Name</TableHead>
                <TableHead>Subscribers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-32 text-center text-slate-500">Loading...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="h-32 text-center text-slate-500">
                    No subscribers yet. Leads captured from your campaigns become subscribers automatically.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((list) => (
                  <TableRow key={list.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium">{list.name}</TableCell>
                    <TableCell>{list.subscribers.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
