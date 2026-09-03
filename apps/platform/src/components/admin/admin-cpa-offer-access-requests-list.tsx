"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedCpaOfferAccessRequest } from "@/services/cpa-offer.service";

const STATUS_TABS = [
  { id: "PENDING", label: "Pending" },
  { id: "APPROVED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
] as const;

function statusBadge(status: SerializedCpaOfferAccessRequest["status"]) {
  if (status === "PENDING") {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
  }
  if (status === "APPROVED") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Approved</Badge>;
  }
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Rejected</Badge>;
}

export function AdminCpaOfferAccessRequestsList() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("PENDING");
  const [items, setItems] = useState<SerializedCpaOfferAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SerializedCpaOfferAccessRequest | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [acting, setActing] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status, limit: "50" });
    const res = await fetch(`/api/v1/admin/cpa-offers/access-requests?${params}`);
    const body = await res.json().catch(() => ({}));
    setItems(body.data?.items ?? []);
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function submitDecision(
    item: SerializedCpaOfferAccessRequest,
    decision: "APPROVED" | "REJECTED",
    adminNote?: string,
  ) {
    setActing(true);
    try {
      const res = await fetch(
        `/api/v1/admin/cpa-offers/access-requests/${item.id}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, adminNote }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error?.message ?? "Unable to update request");
      }
      toast.success(decision === "APPROVED" ? "Request approved" : "Request rejected");
      setRejectOpen(false);
      setRejectNote("");
      setSelected(null);
      await loadRequests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update request");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Offer Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review affiliate requests to promote private CPA offers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            size="sm"
            variant={status === tab.id ? "default" : "outline"}
            onClick={() => setStatus(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
      ) : items.length === 0 ? (
        <div className="rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          No {status === "ALL" ? "" : status.toLowerCase()} requests found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Affiliate</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.publisher.name}</p>
                    <p className="text-xs text-muted-foreground">{item.publisher.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.offer.name}</p>
                    <p className="text-xs text-muted-foreground">Private offer</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{statusBadge(item.status)}</td>
                  <td className="px-4 py-3">
                    {item.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={acting}
                          onClick={() => void submitDecision(item, "APPROVED")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={acting}
                          onClick={() => {
                            setSelected(item);
                            setRejectNote("");
                            setRejectOpen(true);
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    ) : item.adminNote ? (
                      <p className="max-w-xs text-xs text-muted-foreground">{item.adminNote}</p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject access request</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Rejection note</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Explain why this request was rejected..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={acting || !rejectNote.trim() || !selected}
              onClick={() =>
                selected ? void submitDecision(selected, "REJECTED", rejectNote.trim()) : undefined
              }
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
