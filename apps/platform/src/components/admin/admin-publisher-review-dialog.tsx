"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import { Ban, CheckCircle2, ClipboardList, MapPin, ShieldAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SpamScoreBadge, SpamScoreGuide, spamScoreLevel } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type PublisherProfile = {
  website?: string | null;
  trafficSource?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | Date | null;
  kycStatus?: string | null;
  qualityScore?: number | null;
  spamScore?: number | null;
  fraudFlags?: number | null;
};

type PublisherRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string | Date;
  publisherProfile?: PublisherProfile | null;
};

export function AdminPublisherReviewDialog({
  publisher,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  publisher: PublisherRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const profile = publisher.publisherProfile;
  const spamScore = profile?.spamScore ?? null;
  const highSpam = spamScore !== null && spamScoreLevel(spamScore) === "high";

  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [note, setNote] = useState(
    highSpam ? `High spam score (${spamScore}/100) — traffic quality below platform standards.` : "",
  );
  const [status, setStatus] = useState(publisher.status);

  useEffect(() => {
    setStatus(publisher.status);
  }, [publisher.status, publisher.id]);

  function handleOpenChange(nextOpen: boolean) {
    setOpenInternal(nextOpen);
    onOpenChangeProp?.(nextOpen);
    if (nextOpen) {
      setStatus(publisher.status);
      setError(null);
      setSuccess(null);
    }
  }

  async function sendDecision(action: "approve" | "reject") {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/v1/admin/publishers/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: publisher.id,
        action,
        reason: action === "reject" ? note.trim() : undefined,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update publisher status");
      return;
    }

    const nextStatus = action === "approve" ? "ACTIVE" : "SUSPENDED";
    setStatus(nextStatus);
    if (action === "approve") {
      setNote("");
      setSuccess("Publisher approved successfully.");
    } else {
      setSuccess("Publisher rejected and account suspended.");
    }
    router.refresh();
  }

  const isApproved = status === "ACTIVE";
  const isRejected = status === "SUSPENDED";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {openProp === undefined && (
        <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1">Review</Button>}>
          <ClipboardList className="h-3.5 w-3.5" />
          Review
        </DialogTrigger>
      )}
      <DialogContent className="flex max-h-[min(90vh,880px)] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle>Publisher Review</DialogTitle>
          <p className="text-sm text-muted-foreground">{publisher.name} · {publisher.email}</p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{publisher.name}</p>
                  <p className="text-xs text-muted-foreground">{publisher.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {status.toLowerCase()}
                  </Badge>
                  {profile?.kycStatus && (
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                      {profile.kycStatus.toLowerCase()}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p className="text-sm font-medium text-foreground">
                    {formatUserDateTime(publisher.createdAt, session?.user?.timezone, "MMM d, yyyy")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Traffic source</p>
                  <p className="text-sm font-medium text-foreground">{profile?.trafficSource || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Website</p>
                  <p className="break-all text-sm font-medium text-foreground">{profile?.website || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-xs text-muted-foreground">Country</p>
                  <p className="text-sm font-medium text-foreground">{profile?.country || "—"}</p>
                </div>
              </div>
            </div>

            <div
              className={cn(
                "rounded-xl border p-4",
                highSpam ? "border-red-200 bg-red-50/70" : "border-border bg-white",
              )}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className={cn("h-4 w-4", highSpam ? "text-red-600" : "text-[var(--theme-primary)]")} />
                Spam & quality signals (30 days)
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Spam score</p>
                  <div className="mt-1">
                    <SpamScoreBadge score={spamScore} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">Avg lead risk (0 safe, 100 risky)</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Quality score</p>
                  <p className="text-sm font-semibold text-foreground">
                    {profile?.qualityScore != null ? `${profile.qualityScore}%` : "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Lead approval rate</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Fraud flags</p>
                  <p className="text-sm font-semibold text-foreground">{profile?.fraudFlags ?? 0}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Quality warnings triggered</p>
                </div>
              </div>
              {highSpam && (
                <p className="mt-3 rounded-lg border border-red-200 bg-card px-3 py-2 text-sm text-red-700">
                  Spam score is {spamScore}/100 (high risk). Consider rejecting this publisher or
                  reviewing their recent leads before approval.
                </p>
              )}
              {spamScore === null && (
                <p className="mt-3 text-sm text-muted-foreground">
                  No scored leads yet — spam score will appear after the publisher submits traffic.
                </p>
              )}
              <div className="mt-3">
                <SpamScoreGuide compact />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <MapPin className="h-4 w-4 text-[var(--theme-primary)]" />
                Address details
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Address line 1</p>
                  <p className="text-sm font-medium text-foreground">{profile?.addressLine1 || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Address line 2</p>
                  <p className="text-sm font-medium text-foreground">{profile?.addressLine2 || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">City</p>
                  <p className="text-sm font-medium text-foreground">{profile?.city || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">State</p>
                  <p className="text-sm font-medium text-foreground">{profile?.state || "—"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/60 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Postal code</p>
                  <p className="text-sm font-medium text-foreground">{profile?.postalCode || "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Users className="h-4 w-4 text-[var(--theme-primary)]" />
                Approval decision
              </div>
              {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
              {success && (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </p>
              )}
              <div className="mt-4 space-y-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Rejection note (required if rejecting)"
                  rows={2}
                  className={cn(
                    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none",
                    "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15",
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  Rejecting sets the account to Suspended and shows the note on the publisher settings
                  page.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/80 px-5 py-4 sm:flex-row sm:justify-between">
          <DialogClose render={<Button type="button" variant="outline" className="gap-1" />}>
            <X className="h-4 w-4" />
            Close
          </DialogClose>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button
              type="button"
              disabled={loading || isApproved}
              onClick={() => sendDecision("approve")}
              className="gap-1 bg-emerald-600 hover:bg-emerald-600/90 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "..." : isApproved ? "Approved" : "Approve"}
            </Button>
            <Button
              type="button"
              disabled={loading || isApproved || isRejected}
              onClick={() => sendDecision("reject")}
              className="gap-1 bg-red-600 hover:bg-red-600/90 disabled:opacity-50"
            >
              <Ban className="h-4 w-4" />
              Reject
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
