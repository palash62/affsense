"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import { Ban, CheckCircle2, Eye, Globe, MapPin, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, KycStatusBadge, PayoutStatusBadge } from "@/components/admin/admin-ui";
import { isPendingPayoutStatus } from "@/lib/payout-status";
import {
  bankPayoutDetailRows,
  formatPayoutMethodLabel,
  isBankPayoutDetails,
  isEmailPayoutDetails,
  type BankPayoutDetails,
} from "@/lib/payout-payment-details";
import { cn } from "@/lib/utils";
import type { AdminPayoutRow } from "@/lib/payout";

export function AdminPayoutReviewDialog({ payout }: { payout: AdminPayoutRow }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(payout.status);
  const [rejectionReason, setRejectionReason] = useState(payout.rejectionReason ?? "");

  const walletSource =
    payout.kind === "CPA" ? payout.publisher.cpaWallet : payout.publisher.wallet;
  const wallet = walletSource;
  const balance = wallet?.balance ?? null;
  const holdBalance = wallet?.holdBalance ?? null;
  const available = balance !== null && holdBalance !== null ? balance - holdBalance : null;
  const profile = payout.publisher.publisherProfile;
  const canDecide = isPendingPayoutStatus(status);
  const details = payout.paymentDetails;
  const bankDetails = isBankPayoutDetails(details, payout.method)
    ? (details as BankPayoutDetails)
    : null;
  const emailDetails = isEmailPayoutDetails(details, payout.method) ? details : null;

  async function sendDecision(action: "approve" | "reject") {
    if (action === "reject" && !note.trim()) {
      setError("Rejection note is required");
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetch("/api/v1/admin/payouts/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutId: payout.id,
        action,
        reason: action === "reject" ? note.trim() : undefined,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update payout status");
      return;
    }

    if (action === "approve") {
      setStatus("COMPLETED");
      setRejectionReason("");
      setNote("");
    } else {
      setStatus("REJECTED");
      setRejectionReason(note.trim());
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1">View</Button>}>
        <Eye className="h-3.5 w-3.5" />
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payout Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(payout.amount)}
                </p>
                <p className="text-sm text-slate-600">{formatPayoutMethodLabel(payout.method)}</p>
              </div>
              <PayoutStatusBadge status={status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Requested</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatUserDateTime(payout.createdAt, session?.user?.timezone, "MMM d, yyyy HH:mm")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Kind</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {payout.kind === "REFERRAL"
                    ? "Referral"
                    : payout.kind === "CPA"
                      ? "CPA"
                      : "Publisher"}
                </Badge>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Payment method</p>
                <Badge variant="outline" className="mt-1 border-indigo-200 bg-indigo-50 text-indigo-700">
                  {formatPayoutMethodLabel(payout.method)}
                </Badge>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <User className="h-4 w-4 text-[var(--theme-primary)]" />
              Publisher
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">Name</p>
                <p className="text-sm font-medium text-slate-900">{payout.publisher.name}</p>
                <p className="text-xs text-slate-500">{payout.publisher.email}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">KYC status</p>
                <div className="mt-1">
                  <KycStatusBadge status={profile?.kycStatus ?? "NOT_SUBMITTED"} />
                </div>
              </div>
              {profile?.website && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Globe className="h-3 w-3" />
                    Website
                  </p>
                  <p className="break-all text-sm font-medium text-slate-900">{profile.website}</p>
                </div>
              )}
              {(profile?.country || profile?.city) && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    Location
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {[profile.city, profile.state, profile.country].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment details</p>
            {emailDetails ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">Email</p>
                <p className="break-all text-sm font-medium text-slate-900">{emailDetails.email}</p>
              </div>
            ) : bankDetails ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {bankPayoutDetailRows(bankDetails).map((row) => (
                  <div
                    key={row.label}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                  >
                    <p className="text-xs text-slate-500">{row.label}</p>
                    <p className="break-all text-sm font-medium text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No payment details submitted.</p>
            )}
          </div>

          {available !== null && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Wallet className="h-4 w-4 text-[var(--theme-primary)]" />
                Wallet at request time
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="text-xs text-slate-500">Total balance</p>
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(balance!)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="text-xs text-slate-500">On hold</p>
                  <p className="text-sm font-medium text-amber-600">{formatCurrency(holdBalance!)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="text-xs text-slate-500">Available</p>
                  <p className="text-sm font-medium text-emerald-600">{formatCurrency(available)}</p>
                </div>
              </div>
            </div>
          )}

          {rejectionReason && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Rejection note</p>
              <p className="mt-1 text-sm text-red-700">{rejectionReason}</p>
            </div>
          )}

          {canDecide && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-[var(--theme-primary)]" />
                Approval decision
              </div>
              {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Rejection note (required if rejecting)"
                  rows={2}
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none",
                    "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15",
                  )}
                />
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => sendDecision("approve")}
                  className="h-10 gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-600/90"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={() => sendDecision("reject")}
                  className="h-10 gap-1 rounded-xl bg-red-600 hover:bg-red-600/90"
                >
                  <Ban className="h-4 w-4" />
                  Reject
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Approving debits the publisher wallet and marks the payout completed. Rejecting
                returns the request with your note visible to the publisher.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
