"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUserDateTime } from "@/lib/user-timezone";

type EmailLogRow = {
  id: string;
  to: string;
  template: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
};

const PAGE_SIZE = 10;

export function EmailLogsTable() {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [logs, setLogs] = useState<EmailLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPage = useCallback((nextPage: number) => {
    setLoading(true);
    setError("");
    fetch(`/api/v1/admin/email/logs?page=${nextPage}&limit=${PAGE_SIZE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load email logs (HTTP ${res.status})`);
        const body = await res.json();
        setLogs(body.data ?? []);
        const meta = body.meta ?? {};
        setPage(meta.page ?? nextPage);
        setTotal(meta.total ?? 0);
        setTotalPages(Math.max(1, meta.totalPages ?? 1));
      })
      .catch((err) => setError(err?.message ?? "Could not load email logs."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPage(page);
  }, [page, loadPage]);

  if (loading && logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading email log...</p>;
  }

  if (error && logs.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!loading && logs.length === 0) {
    return <p className="text-sm text-muted-foreground">No emails logged yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">To</th>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatUserDateTime(log.createdAt, timezone, "MMM d, yyyy HH:mm")}
                </td>
                <td className="px-4 py-3">{log.to}</td>
                <td className="px-4 py-3">{log.template}</td>
                <td className="px-4 py-3 max-w-xs truncate" title={log.subject}>
                  {log.subject}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      log.status === "sent"
                        ? "default"
                        : log.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {log.status}
                  </Badge>
                  {log.error && (
                    <p className="mt-1 text-xs text-red-600" title={log.error}>
                      {log.error}
                    </p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {page} of {totalPages}
          {total > 0 ? ` · ${total} total` : ""}
          {loading ? " · Loading..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
