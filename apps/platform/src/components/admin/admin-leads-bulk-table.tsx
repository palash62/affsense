"use client";

import { Suspense, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LeadStatusBadge } from "@/components/admin/admin-ui";
import { AdvertiserLeadsSortHeader } from "@/components/advertiser/advertiser-leads-sort-header";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const REJECTABLE_STATUSES = new Set([
  "CAPTURED",
  "VALIDATING",
  "PENDING",
  "APPROVED",
  "PAID",
]);

export type AdminLeadTableRow = {
  id: string;
  status: string;
  createdAtLabel: string;
  shortId: string;
  advertiserName: string;
  campaignName: string;
  publisherName: string;
  leadData: string;
  country: string;
  ip: string;
  source: string;
  subId: string;
  device: string;
  os: string;
  cpl: string;
  sales: string;
  revenue: string;
  ctaClicked: boolean;
  riskScore: number | null;
  flags: string[];
  notes: string;
};

function riskBadge(score: number | null) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const cls =
    score > 50
      ? "bg-red-100 text-red-700"
      : score > 20
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-700";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", cls)}>
      {score}
    </span>
  );
}

export function AdminLeadsBulkTable({ rows }: { rows: AdminLeadTableRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const rejectableIds = useMemo(
    () => rows.filter((r) => REJECTABLE_STATUSES.has(r.status)).map((r) => r.id),
    [rows],
  );

  const selectedRejectable = useMemo(
    () => rejectableIds.filter((id) => selected.has(id)),
    [rejectableIds, selected],
  );

  const selectedHasPaid = useMemo(
    () =>
      rows.some((r) => selected.has(r.id) && r.status === "PAID"),
    [rows, selected],
  );

  const allRejectableSelected =
    rejectableIds.length > 0 && rejectableIds.every((id) => selected.has(id));

  function toggleAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of rejectableIds) next.add(id);
      } else {
        for (const id of rejectableIds) next.delete(id);
      }
      return next;
    });
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleReject() {
    if (selectedRejectable.length === 0) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/v1/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: selectedRejectable,
          status: "REJECTED",
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Failed to reject leads.");
        setBusy(false);
        return;
      }

      window.location.reload();
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {selectedRejectable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selectedRejectable.length} selected
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              setError("");
              setReason("");
              setOpen(true);
            }}
          >
            Reject
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow
              className="border-none hover:bg-transparent"
              style={{ background: "var(--theme-primary-soft)" }}
            >
              <TableHead className="h-11 w-10 px-4 text-muted-foreground">
                <Checkbox
                  checked={allRejectableSelected}
                  disabled={rejectableIds.length === 0}
                  onCheckedChange={(value) => toggleAll(value === true)}
                  aria-label="Select all rejectable leads on this page"
                />
              </TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">
                <Suspense fallback={<span>Date / Time</span>}>
                  <AdvertiserLeadsSortHeader field="at" label="Date / Time" />
                </Suspense>
              </TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Lead ID</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Advertiser</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">
                <Suspense fallback={<span>Campaign</span>}>
                  <AdvertiserLeadsSortHeader field="campaign" label="Campaign" />
                </Suspense>
              </TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Publisher</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Lead Data</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Country</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">IP</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Source</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Sub ID</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Device</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">OS</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-right text-muted-foreground">CPL</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-right text-muted-foreground">Sales</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-right text-muted-foreground">Revenue</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">CTA</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Risk</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">Flags</TableHead>
              <TableHead className="h-11 whitespace-nowrap px-4 text-muted-foreground">
                <Suspense fallback={<span>Status</span>}>
                  <AdvertiserLeadsSortHeader field="status" label="Status" />
                </Suspense>
              </TableHead>
              <TableHead className="h-11 min-w-[160px] whitespace-nowrap px-4 text-muted-foreground">
                Notes
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={21} className="h-48 px-6 py-16 text-center">
                  <p className="text-base font-medium text-muted-foreground">No leads found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting the filters or date range.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((lead) => {
                const rejectable = REJECTABLE_STATUSES.has(lead.status);
                return (
                  <TableRow
                    key={lead.id}
                    className="border-border transition-colors hover:bg-violet-50/40"
                  >
                    <TableCell className="px-4 py-4">
                      {rejectable ? (
                        <Checkbox
                          checked={selected.has(lead.id)}
                          onCheckedChange={(value) => toggleOne(lead.id, value === true)}
                          aria-label={`Select lead ${lead.shortId}`}
                        />
                      ) : (
                        <span className="inline-block size-4" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {lead.createdAtLabel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-muted-foreground">
                      {lead.shortId}
                    </TableCell>
                    <TableCell className="max-w-[120px] px-4 py-4 text-sm text-foreground">
                      <span className="line-clamp-2" title={lead.advertiserName}>
                        {lead.advertiserName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[140px] px-4 py-4 text-sm font-medium text-foreground">
                      <span className="line-clamp-2" title={lead.campaignName}>
                        {lead.campaignName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[120px] px-4 py-4 text-sm text-foreground">
                      <span className="line-clamp-2" title={lead.publisherName}>
                        {lead.publisherName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[220px] px-4 py-4 text-sm text-foreground">
                      <span className="line-clamp-2" title={lead.leadData}>
                        {lead.leadData}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {lead.country}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 font-mono text-xs text-muted-foreground">
                      {lead.ip}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {lead.source}
                    </TableCell>
                    <TableCell className="max-w-[100px] truncate px-4 py-4 text-sm text-muted-foreground">
                      {lead.subId}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {lead.device}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                      {lead.os}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-foreground">
                      {lead.cpl}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-foreground">
                      {lead.sales}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4 text-right text-sm text-foreground">
                      {lead.revenue}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-4 py-4">
                      {lead.ctaClicked ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Yes
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-slate-200">
                          No
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4">{riskBadge(lead.riskScore)}</TableCell>
                    <TableCell className="px-4 py-4">
                      {lead.flags.length > 0 ? (
                        <div className="flex max-w-[140px] flex-wrap gap-1">
                          {lead.flags.slice(0, 3).map((flag) => (
                            <span
                              key={flag}
                              className="rounded bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] text-rose-700"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <LeadStatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className="max-w-[180px] px-4 py-4 text-sm text-muted-foreground">
                      <span className="line-clamp-2" title={lead.notes}>
                        {lead.notes}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reject {selectedRejectable.length} lead{selectedRejectable.length === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          {selectedHasPaid ? (
            <p className="text-sm text-amber-800">
              One or more selected leads were paid. Rejecting will refund the advertiser, claw back
              publisher and referral earnings, and reduce campaign spend for those leads.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selected leads will be marked as rejected. No payment will be processed.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="bulk-reject-reason">Reject note (optional)</Label>
            <textarea
              id="bulk-reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are these leads being rejected?"
              rows={3}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void handleReject()}
            >
              {busy ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
