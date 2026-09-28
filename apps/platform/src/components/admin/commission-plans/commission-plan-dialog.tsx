"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AffiliateSearchMultiSelect } from "./affiliate-search-multi-select";
import type { CommissionPlanDraft, CommissionPlanKind, PlanUpsellOption } from "./types";

type CommissionPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: CommissionPlanKind;
  initial: CommissionPlanDraft;
  /** CPA: "$" or "%" suffix for the payout field. */
  payoutSuffix?: string;
  defaultPayout?: string;
  defaultFrontEnd?: string;
  upsells?: PlanUpsellOption[];
  takenBy: Map<string, string>;
  onSubmit: (draft: CommissionPlanDraft) => Promise<void> | void;
};

export function CommissionPlanDialog({
  open,
  onOpenChange,
  kind,
  initial,
  payoutSuffix = "$",
  defaultPayout,
  defaultFrontEnd,
  upsells = [],
  takenBy,
  onSubmit,
}: CommissionPlanDialogProps) {
  const [draft, setDraft] = useState<CommissionPlanDraft>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(initial);
  }, [open, initial]);

  function patch(partial: Partial<CommissionPlanDraft>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  async function handleSubmit() {
    if (!draft.name.trim()) {
      toast.error("Enter a plan name");
      return;
    }
    const rate = Number(kind === "cpa" ? draft.payout : draft.frontEndCommission);
    if (!Number.isFinite(rate) || rate < 0) {
      toast.error(kind === "cpa" ? "Enter a valid payout" : "Enter a valid front-end commission");
      return;
    }
    if (kind === "digital" && rate > 100) {
      toast.error("Commission cannot exceed 100%");
      return;
    }
    setSaving(true);
    try {
      await onSubmit(draft);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save commission plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id || initial.name ? "Edit commission plan" : "New commission plan"}</DialogTitle>
          <DialogDescription>
            Affiliates in this plan earn the plan rate on this product instead of the default.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[65vh] gap-4 overflow-y-auto pr-1">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Plan name<span className="ml-0.5 text-red-500">*</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="e.g. Top affiliates"
            />
          </div>

          {kind === "cpa" ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Payout ({payoutSuffix})<span className="ml-0.5 text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.payout}
                onChange={(e) => patch({ payout: e.target.value })}
                placeholder={defaultPayout ? `Default ${defaultPayout}` : "0.00"}
              />
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Front-end commission (%)<span className="ml-0.5 text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.frontEndCommission}
                  onChange={(e) => patch({ frontEndCommission: e.target.value })}
                  placeholder={defaultFrontEnd ? `Default ${defaultFrontEnd}%` : "0"}
                />
              </div>
              {upsells.length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Upsell commissions (%)</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave blank to use the upsell&apos;s default rate. New upsells must be saved on
                    the product first.
                  </p>
                  {upsells.map((upsell) => (
                    <div key={upsell.pageSlug} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={upsell.name}>
                        {upsell.name || upsell.pageSlug}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="w-28"
                        value={draft.upsellRates[upsell.pageSlug] ?? ""}
                        onChange={(e) =>
                          patch({
                            upsellRates: { ...draft.upsellRates, [upsell.pageSlug]: e.target.value },
                          })
                        }
                        placeholder={`${upsell.commissionPct}%`}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Affiliates</Label>
            <AffiliateSearchMultiSelect
              selected={draft.members}
              onChange={(members) => patch({ members })}
              takenBy={takenBy}
            />
            <p className="text-xs text-muted-foreground">
              An affiliate can be in only one plan per product.
            </p>
          </div>

          <label className="flex items-center gap-2">
            <Checkbox
              checked={draft.isActive}
              onCheckedChange={(checked) => patch({ isActive: checked === true })}
            />
            <span className="text-sm font-medium text-foreground">Plan active</span>
          </label>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Saving..." : "Save plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
