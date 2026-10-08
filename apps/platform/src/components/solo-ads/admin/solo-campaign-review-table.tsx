"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SoloStatusBadge, formatUsdCents, soloRequest } from "@/components/solo-ads/solo-ui";

export type AdminSoloCampaignRow = {
  id: string;
  name: string;
  status: string;
  statusReason: string | null;
  offerType: "CPA" | "DIGITAL";
  offerName: string;
  offerActive: boolean;
  trafficType: "REGULAR" | "WARM";
  destinationMode: "DIRECT" | "EXTERNAL";
  destinationUrl: string | null;
  trackingVerified: boolean;
  countries: string[];
  dailyBudgetCents: number;
  lifetimeBudgetCents: number;
  spentCents: number;
  cpcCentsSnapshot: number;
  priority: number;
  submittedAt: string | null;
  publisher: { id: string; name: string; email: string; memberNo: number };
};

type ActionKind = "approve" | "reject" | "pause" | "resume" | "terminate" | "priority" | "verify_tracking";

const STATUS_FILTERS = [
  { value: "PENDING_REVIEW", label: "Waiting for review" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "INSUFFICIENT_FUNDS", label: "No funds" },
  { value: "BUDGET_EXHAUSTED", label: "Budget used" },
  { value: "REJECTED", label: "Rejected" },
  { value: "COMPLETED", label: "Completed" },
  { value: "", label: "All" },
];

const NEEDS_REASON: ActionKind[] = ["reject", "pause", "terminate", "priority", "verify_tracking"];

export function SoloCampaignReviewTable({ campaigns, status }: { campaigns: AdminSoloCampaignRow[]; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<{ campaign: AdminSoloCampaignRow; action: ActionKind } | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("1");
  const [busy, setBusy] = useState(false);

  async function run(campaign: AdminSoloCampaignRow, action: ActionKind, extra?: { reason?: string; priority?: number }) {
    setBusy(true);
    try {
      await soloRequest(`/api/v1/admin/solo-ads/campaigns/${campaign.id}/review`, { body: { action, ...extra } });
      toast.success("Campaign updated");
      setPending(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function start(campaign: AdminSoloCampaignRow, action: ActionKind) {
    if (!NEEDS_REASON.includes(action)) {
      void run(campaign, action);
      return;
    }
    setReason("");
    setPriority(String(campaign.priority));
    setPending({ campaign, action });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value || "all"}
            href={f.value ? `/admin/solo-ads/campaigns?status=${f.value}` : "/admin/solo-ads/campaigns?status="}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              status === f.value ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border bg-card"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="premium-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead>Offer</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No campaigns in this view.
                </TableCell>
              </TableRow>
            ) : null}
            {campaigns.map((c) => (
              <TableRow key={c.id} className="align-top">
                <TableCell>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.trafficType === "WARM" ? "Warm" : "Regular"} · {formatUsdCents(c.cpcCentsSnapshot)}/click · {c.countries.join(", ")}
                  </div>
                  {c.priority !== 1 ? <div className="text-xs text-indigo-600">Priority ×{c.priority}</div> : null}
                </TableCell>
                <TableCell>
                  <div className="text-sm">{c.publisher.name}</div>
                  <div className="text-xs text-muted-foreground">{c.publisher.email}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{c.offerName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.offerType === "CPA" ? "CPA offer" : "Digital product"}
                    {!c.offerActive ? <span className="ml-1 text-red-600">(inactive)</span> : null}
                  </div>
                </TableCell>
                <TableCell className="max-w-[240px]">
                  {c.destinationMode === "DIRECT" ? (
                    <span className="text-sm">Direct to offer</span>
                  ) : (
                    <>
                      <a href={c.destinationUrl ?? "#"} target="_blank" rel="noreferrer noopener" className="block truncate text-sm text-[var(--theme-primary)] hover:underline">
                        {c.destinationUrl}
                      </a>
                      <span className={`text-xs ${c.trackingVerified ? "text-emerald-600" : "text-amber-600"}`}>
                        {c.trackingVerified ? "Tracking script verified" : "Tracking script not seen yet"}
                      </span>
                      {!c.trackingVerified ? (
                        <button
                          type="button"
                          className="ml-2 text-xs text-[var(--theme-primary)] hover:underline"
                          onClick={() => start(c, "verify_tracking")}
                        >
                          Mark verified
                        </button>
                      ) : null}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  <div>{formatUsdCents(c.dailyBudgetCents)}/day</div>
                  <div className="text-xs text-muted-foreground">
                    {formatUsdCents(c.spentCents)} of {formatUsdCents(c.lifetimeBudgetCents)}
                  </div>
                </TableCell>
                <TableCell>
                  <SoloStatusBadge status={c.status} />
                  {c.statusReason ? <div className="mt-1 max-w-[200px] text-xs text-muted-foreground">{c.statusReason}</div> : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-end gap-1">
                    {c.status === "PENDING_REVIEW" ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => start(c, "approve")}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => start(c, "reject")}>
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {["ACTIVE", "INSUFFICIENT_FUNDS", "BUDGET_EXHAUSTED"].includes(c.status) ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => start(c, "pause")}>
                        Pause
                      </Button>
                    ) : null}
                    {c.status === "PAUSED" ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => start(c, "resume")}>
                        Resume
                      </Button>
                    ) : null}
                    {!["COMPLETED", "REJECTED", "DRAFT"].includes(c.status) ? (
                      <>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => start(c, "priority")}>
                          Priority
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => start(c, "terminate")}>
                          End
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {pending?.action === "terminate"
                ? "End campaign"
                : pending?.action === "verify_tracking"
                  ? "Mark tracking verified"
                  : `${pending?.action} campaign`}
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending) void run(pending.campaign, pending.action, { reason, priority: Number(priority) });
            }}
          >
            <p className="text-sm text-muted-foreground">{pending?.campaign.name}</p>
            {pending?.action === "priority" ? (
              <div className="space-y-1.5">
                <Label htmlFor="solo-priority">Routing priority (1 = normal, up to 10)</Label>
                <Input id="solo-priority" type="number" min="1" max="10" value={priority} onChange={(e) => setPriority(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="solo-reason">
                {pending?.action === "reject" ? "Reason shown to the affiliate" : "Reason (saved in the audit log)"}
              </Label>
              <textarea
                id="solo-reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Confirm
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
