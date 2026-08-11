"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
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
import { formatUserDateTime } from "@/lib/user-timezone";
import { useEmailModuleFilters } from "../email-module-filter-context";
import { EmailModuleShell } from "../email-module-shell";
import { EmailWalletWarningBanner } from "../email-wallet-warning";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  SENT: "default",
  DELIVERED: "default",
  QUEUED: "secondary",
  FAILED: "destructive",
};

const PAGE_SIZE = 25;

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
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const { search, filterValues } = useEmailModuleFilters();
  const [rows, setRows] = useState<SendRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, filterValues.status]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (filterValues.status && filterValues.status !== "all") {
      params.set("status", filterValues.status);
    }
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/v1/advertiser/email/sends?${params}`)
      .then((r) => r.json())
      .then((j) => {
        setRows(j.data?.items ?? []);
        setTotal(j.data?.total ?? 0);
        setTotalPages(j.data?.totalPages ?? 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterValues.status, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/provider")
      .then((r) => r.json())
      .then((j) => setProvider(j.data?.marketingProvider ?? null))
      .catch(() => setProvider(null));
  }, []);

  return (
    <PageSection title={`Delivery History (${total})`} icon={ScrollText} gradient="leads">
      <div className="border-b border-slate-100 px-6 pt-4">
        <EmailWalletWarningBanner />
      </div>
      {provider === "mailgun" ? (
        <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
          Delivery, bounce, and complaint status update from Mailgun webhooks. Opens and clicks use
          first-party tracking pixels.
        </p>
      ) : provider ? (
        <p className="border-b border-slate-100 px-6 py-3 text-sm text-amber-800">
          Mailgun is required for delivery webhooks. Current provider: <strong>{provider}</strong>.
        </p>
      ) : null}
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
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                  No email sends found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="transition-colors hover:bg-slate-50">
                  <TableCell className="font-medium">{row.contact.email}</TableCell>
                  <TableCell className="text-slate-600">{row.template.subject}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>
                      {row.status.toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.hasOpen ? "Yes" : "—"}</TableCell>
                  <TableCell>{row.hasClick ? "Yes" : "—"}</TableCell>
                  <TableCell className="text-slate-500">
                    {row.sentAt
                      ? formatUserDateTime(row.sentAt, timezone, "MMM d, yyyy HH:mm")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
        <p className="text-sm text-slate-500">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </PageSection>
  );
}

export function LogsPanel() {
  return (
    <EmailModuleShell
      title="Email Logs"
      description="Delivery history for automation sends. Use search and filters to find a recipient or subject."
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
