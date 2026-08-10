"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/admin/admin-ui";

type ValidationResult = {
  rule: string;
  passed: boolean;
  riskDelta: number | null;
  details: string | null;
};

type FraudLeadRow = {
  id: string;
  status: string;
  riskScore: number | null;
  fraudDecision: string | null;
  createdAt: string;
  campaign: { name: string };
  publisher: { name: string; email: string };
  validationResults: ValidationResult[];
};

function riskBadge(score: number | null) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const color =
    score > 50 ? "bg-red-100 text-red-700" : score > 20 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

export function FraudLeadActions({ lead }: { lead: FraudLeadRow }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function decide(status: "APPROVED" | "REJECTED") {
    setBusy(true);
    await fetch("/api/v1/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: lead.id,
        status,
        reason: status === "REJECTED" ? "Rejected from fraud center" : undefined,
      }),
    });
    setBusy(false);
    window.location.reload();
  }

  const failedRules = lead.validationResults.filter((r) => !r.passed);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {riskBadge(lead.riskScore)}
        <LeadStatusBadge status={lead.status as never} />
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Details"}
        </Button>
        {lead.status === "PENDING" && (
          <>
            <Button type="button" size="sm" disabled={busy} onClick={() => void decide("APPROVED")}>
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void decide("REJECTED")}
            >
              Reject
            </Button>
          </>
        )}
      </div>
      {open && (
        <div className="rounded-lg border border-border bg-muted/80 p-3 text-xs">
          <p className="font-medium text-foreground">
            {lead.campaign.name} · {lead.publisher.name}
          </p>
          {lead.fraudDecision && (
            <p className="mt-1 text-muted-foreground">Decision: {lead.fraudDecision}</p>
          )}
          {failedRules.length > 0 ? (
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {failedRules.map((r) => (
                <li key={r.rule}>
                  <span className="font-mono text-red-600">{r.rule}</span>
                  {r.riskDelta != null && ` (+${r.riskDelta})`}
                  {r.details ? ` — ${r.details}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No failed fraud rules.</p>
          )}
        </div>
      )}
    </div>
  );
}
