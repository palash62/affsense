"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readApiErrorMessage } from "@/lib/errors";
import { CommissionPlanDialog } from "./commission-plan-dialog";
import {
  commissionPlansBaseUrl,
  draftFromDto,
  newDraftKey,
  saveCommissionPlan,
  type CommissionPlanDraft,
  type CommissionPlanKind,
  type PlanUpsellOption,
} from "./types";

type CommissionPlansSectionProps = {
  kind: CommissionPlanKind;
  /** Saved product id. When set, plans load from and save to the API immediately. */
  entityId?: string;
  /** Create mode: plans kept in parent state and saved after the product is created. */
  drafts?: CommissionPlanDraft[];
  onDraftsChange?: (drafts: CommissionPlanDraft[]) => void;
  payoutSuffix?: string;
  defaultPayout?: string;
  defaultFrontEnd?: string;
  upsells?: PlanUpsellOption[];
};

function emptyDraft(defaultPayout?: string, defaultFrontEnd?: string): CommissionPlanDraft {
  return {
    key: newDraftKey(),
    name: "",
    isActive: true,
    payout: defaultPayout ?? "",
    frontEndCommission: defaultFrontEnd ?? "",
    upsellRates: {},
    members: [],
  };
}

export function CommissionPlansSection({
  kind,
  entityId,
  drafts,
  onDraftsChange,
  payoutSuffix = "$",
  defaultPayout,
  defaultFrontEnd,
  upsells = [],
}: CommissionPlansSectionProps) {
  const apiMode = Boolean(entityId);
  const [remotePlans, setRemotePlans] = useState<CommissionPlanDraft[]>([]);
  const [loading, setLoading] = useState(apiMode);
  const [editing, setEditing] = useState<CommissionPlanDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const plans = apiMode ? remotePlans : (drafts ?? []);

  useEffect(() => {
    if (!entityId) return;
    const ac = new AbortController();
    setLoading(true);
    fetch(commissionPlansBaseUrl(kind, entityId), { signal: ac.signal })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(json, "Could not load commission plans", res.status));
        }
        return json?.data ?? [];
      })
      .then((rows) => {
        if (!ac.signal.aborted) setRemotePlans(rows.map(draftFromDto));
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted) return;
        toast.error(error instanceof Error ? error.message : "Could not load commission plans");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [kind, entityId]);

  const takenBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) {
      if (editing && plan.key === editing.key) continue;
      for (const member of plan.members) map.set(member.publisherId, plan.name);
    }
    return map;
  }, [plans, editing]);

  function openCreate() {
    setEditing(emptyDraft(defaultPayout, defaultFrontEnd));
    setDialogOpen(true);
  }

  function openEdit(plan: CommissionPlanDraft) {
    setEditing(plan);
    setDialogOpen(true);
  }

  async function handleSubmit(draft: CommissionPlanDraft) {
    if (entityId) {
      const saved = await saveCommissionPlan(kind, entityId, draft);
      setRemotePlans((prev) =>
        draft.id ? prev.map((p) => (p.id === draft.id ? saved : p)) : [...prev, saved],
      );
      toast.success(draft.id ? "Commission plan updated" : "Commission plan created");
      return;
    }
    const current = drafts ?? [];
    const exists = current.some((p) => p.key === draft.key);
    onDraftsChange?.(
      exists ? current.map((p) => (p.key === draft.key ? draft : p)) : [...current, draft],
    );
  }

  async function handleDelete(plan: CommissionPlanDraft) {
    if (!window.confirm(`Delete commission plan "${plan.name}"?`)) return;
    if (entityId && plan.id) {
      const res = await fetch(`${commissionPlansBaseUrl(kind, entityId)}/${plan.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast.error(readApiErrorMessage(json, "Could not delete commission plan", res.status));
        return;
      }
      setRemotePlans((prev) => prev.filter((p) => p.id !== plan.id));
      toast.success("Commission plan deleted");
      return;
    }
    onDraftsChange?.((drafts ?? []).filter((p) => p.key !== plan.key));
  }

  function rateLabel(plan: CommissionPlanDraft) {
    if (kind === "cpa") {
      const amount = Number(plan.payout) || 0;
      return payoutSuffix === "%" ? `${amount.toFixed(2)}%` : `$${amount.toFixed(2)}`;
    }
    const upsellCount = Object.values(plan.upsellRates).filter((v) => v.trim() !== "").length;
    const fe = `${Number(plan.frontEndCommission) || 0}% front end`;
    return upsellCount > 0 ? `${fe} · ${upsellCount} upsell rate${upsellCount === 1 ? "" : "s"}` : fe;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Give selected affiliates a higher commission on this product.
          {!apiMode ? " Plans are saved when the product is created." : ""}
        </p>
        <Button type="button" variant="outline" className="h-9 gap-1" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add plan
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading commission plans...</p>
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No commission plans yet. Every affiliate earns the default rate.
        </div>
      ) : (
        <div className="grid gap-2">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{plan.name}</span>
                  <Badge variant="outline" className={plan.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "text-muted-foreground"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {rateLabel(plan)}
                  <span className="mx-1.5">·</span>
                  <Users className="mr-0.5 inline h-3 w-3" />
                  {plan.members.length} affiliate{plan.members.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(plan)}
                  aria-label={`Edit ${plan.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                  onClick={() => void handleDelete(plan)}
                  aria-label={`Delete ${plan.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing ? (
        <CommissionPlanDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditing(null);
          }}
          kind={kind}
          initial={editing}
          payoutSuffix={payoutSuffix}
          defaultPayout={defaultPayout}
          defaultFrontEnd={defaultFrontEnd}
          upsells={upsells}
          takenBy={takenBy}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
