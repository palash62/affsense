"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BarChart3 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUserDateTime } from "@/lib/user-timezone";

type ReportRow = {
  id: string;
  createdAt: string;
  subject: string;
  audience: string;
  sent: number;
  failed: number;
  skipped: number;
};

function audienceLabel(audience: string) {
  if (audience === "ADVERTISER") return "Advertiser";
  if (audience === "PUBLISHER") return "Publisher";
  if (audience === "MIXED") return "Mixed";
  return "—";
}

type AdminBulkEmailReportProps = {
  refreshKey?: number;
};

export function AdminBulkEmailReport({ refreshKey = 0 }: AdminBulkEmailReportProps) {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/bulk-email/report", {
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Unable to load report");
      }
      setRows((json.data?.rows ?? []) as ReportRow[]);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Unable to load report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="space-y-4 rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--theme-primary)]" />
          <h2 className="text-lg font-semibold text-slate-900">Send report</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">Recent bulk email sends.</p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Advertiser / Publisher</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-slate-500">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-20 text-center text-slate-500">
                  No bulk emails sent yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {formatUserDateTime(row.createdAt, timezone, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate font-medium">
                    {row.subject}
                  </TableCell>
                  <TableCell>{audienceLabel(row.audience)}</TableCell>
                  <TableCell className="text-right">{row.sent.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.failed.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.skipped.toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
