"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import { Ban, Building2, CheckCircle2, Eye, FileText, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";

type CampaignField = {
  fieldName: string;
  label: string;
  fieldType: string;
  required: boolean;
};

type CampaignRow = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  cpl: unknown;
  budget: unknown;
  spent: unknown;
  dailyCap?: number | null;
  monthlyCap?: number | null;
  status: string;
  targeting: unknown;
  rejectionReason?: string | null;
  rejectedAt?: string | Date | null;
  createdAt: string | Date;
  advertiser: { name: string; email: string };
  fields?: CampaignField[];
  _count?: { leads: number };
};

function readTargeting(targeting: unknown) {
  if (!targeting || typeof targeting !== "object") return {};
  return targeting as Record<string, unknown>;
}

export function AdminCampaignReviewDialog({ campaign }: { campaign: CampaignRow }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(campaign.status);
  const [rejectionReason, setRejectionReason] = useState(campaign.rejectionReason ?? "");

  async function sendDecision(action: "approve" | "reject") {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/v1/admin/campaigns/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        action,
        reason: action === "reject" ? note.trim() : undefined,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update campaign status");
      return;
    }

    if (action === "approve") {
      setStatus("ACTIVE");
      setRejectionReason("");
      setNote("");
    } else {
      setStatus("ARCHIVED");
      setRejectionReason(note.trim());
    }
    router.refresh();
  }

  const targeting = readTargeting(campaign.targeting);
  const destinationUrl =
    typeof targeting.destinationUrl === "string" ? targeting.destinationUrl : null;
  const vertical = typeof targeting.vertical === "string" ? targeting.vertical : null;
  const canDecide = status === "PENDING";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1">View</Button>}>
        <Eye className="h-3.5 w-3.5" />
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Campaign Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{campaign.name}</p>
                <p className="text-xs capitalize text-slate-500">{campaign.category.toLowerCase()}</p>
              </div>
              <CampaignStatusBadge status={status} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Advertiser</p>
                <p className="text-sm font-medium text-slate-900">{campaign.advertiser.name}</p>
                <p className="text-xs text-slate-500">{campaign.advertiser.email}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Submitted</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatUserDateTime(campaign.createdAt, session?.user?.timezone, "MMM d, yyyy")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">CPL bid</p>
                <p className="text-sm font-medium text-slate-900">{formatCurrency(Number(campaign.cpl))}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Budget</p>
                <p className="text-sm font-medium text-slate-900">
                  {campaign.budget == null
                    ? "Unlimited"
                    : formatCurrency(Number(campaign.budget))}
                  {campaign.dailyCap ? ` · ${campaign.dailyCap}/day cap` : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Building2 className="h-4 w-4 text-[var(--theme-primary)]" />
              Campaign details
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">Optin page destination</p>
                <p className="break-all text-sm font-medium text-slate-900">{destinationUrl || "—"}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                <p className="text-xs text-slate-500">Vertical</p>
                <p className="text-sm font-medium text-slate-900">{vertical || "—"}</p>
              </div>
            </div>
            {campaign.description && (
              <p className="mt-3 text-sm text-slate-600">{campaign.description}</p>
            )}
          </div>

          {campaign.fields && campaign.fields.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-4 w-4 text-[var(--theme-primary)]" />
                Lead fields
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {campaign.fields.map((field) => (
                  <Badge key={field.fieldName} variant="outline" className="text-xs font-normal">
                    {field.label}
                    {field.required ? " *" : ""}
                  </Badge>
                ))}
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
                <Target className="h-4 w-4 text-[var(--theme-primary)]" />
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
                Approving sets the campaign to Active. Rejecting archives it and shows the note to the
                advertiser.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
