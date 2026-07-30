"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import { Ban, Building2, CheckCircle2, Eye, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DepositStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { formatDepositMethod, type AdminDepositRow } from "@/lib/deposit";
import { cn } from "@/lib/utils";

export function AdminDepositReviewDialog({ deposit }: { deposit: AdminDepositRow }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(deposit.status);
  const [rejectionReason, setRejectionReason] = useState(deposit.rejectionReason ?? "");

  const profile = deposit.user.advertiserProfile;
  const details = deposit.paymentDetails;
  const canDecide = status === "PENDING";

  async function sendDecision(action: "approve" | "reject") {
    if (action === "reject" && !note.trim()) {
      setError("Rejection note is required");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/v1/admin/deposits/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        depositId: deposit.id,
        action,
        reason: action === "reject" ? note.trim() : undefined,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update deposit status");
      return;
    }

    if (action === "approve") {
      setStatus("COMPLETED");
      setRejectionReason("");
      setNote("");
    } else {
      setStatus("FAILED");
      setRejectionReason(note.trim());
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1">Review</Button>}>
        <Eye className="h-3.5 w-3.5" />
        Review
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Wise Deposit Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(deposit.amount)}
                </p>
                <p className="text-sm text-slate-500">{formatDepositMethod(deposit.method)}</p>
              </div>
              <DepositStatusBadge status={status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Submitted</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatUserDateTime(deposit.createdAt, session?.user?.timezone, "MMM d, yyyy HH:mm")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Wise reference</p>
                <p className="font-mono text-sm font-medium text-slate-900">
                  {deposit.wiseReference ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Advertiser</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <User className="mt-0.5 h-4 w-4 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{deposit.user.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Mail className="h-3 w-3" />
                    {deposit.user.email}
                  </p>
                </div>
              </div>
              {profile && (
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{profile.company}</p>
                    {profile.industry && (
                      <p className="text-xs text-slate-500">{profile.industry}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Payment details</h4>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Payer name</dt>
                <dd className="font-medium text-slate-900">{details?.payerName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Advertiser note</dt>
                <dd className="max-w-xs text-right font-medium text-slate-900">{details?.note ?? "—"}</dd>
              </div>
              {profile?.billingInfo != null && (
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-medium text-slate-500">Billing profile</p>
                  <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-slate-700">
                    {JSON.stringify(profile.billingInfo, null, 2)}
                  </pre>
                </div>
              )}
            </dl>
          </div>

          {rejectionReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              Rejected: {rejectionReason}
            </div>
          )}

          {canDecide && (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Rejection note (required if rejecting)"
                rows={2}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => sendDecision("approve")}
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve & credit wallet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => sendDecision("reject")}
                  className={cn("gap-1 border-red-200 text-red-700 hover:bg-red-50")}
                >
                  <Ban className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
