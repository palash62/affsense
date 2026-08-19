"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign } from "lucide-react";
import { TIER_PAYOUT_ROWS } from "@/lib/platform-settings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/components/admin/admin-ui";

export type PublisherSpecialPayoutSettings = {
  useSpecialTierPayouts: boolean;
  tier1SpecialPayout: number | null;
  tier2SpecialPayout: number | null;
  tier3SpecialPayout: number | null;
};

type AdminPublisherSpecialPayoutDialogProps = {
  publisherId: string;
  publisherName: string;
  settings: PublisherSpecialPayoutSettings;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const TIER_FIELDS = [
  { key: "tier1SpecialPayout" as const, row: TIER_PAYOUT_ROWS[0] },
  { key: "tier2SpecialPayout" as const, row: TIER_PAYOUT_ROWS[1] },
  { key: "tier3SpecialPayout" as const, row: TIER_PAYOUT_ROWS[2] },
];

export function AdminPublisherSpecialPayoutDialog({
  publisherId,
  publisherName,
  settings,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: AdminPublisherSpecialPayoutDialogProps) {
  const router = useRouter();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  function setOpen(next: boolean) {
    setOpenInternal(next);
    onOpenChangeProp?.(next);
  }
  const [enabled, setEnabled] = useState(settings.useSpecialTierPayouts);
  const [tier1, setTier1] = useState(
    settings.tier1SpecialPayout != null ? String(settings.tier1SpecialPayout) : "",
  );
  const [tier2, setTier2] = useState(
    settings.tier2SpecialPayout != null ? String(settings.tier2SpecialPayout) : "",
  );
  const [tier3, setTier3] = useState(
    settings.tier3SpecialPayout != null ? String(settings.tier3SpecialPayout) : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tierValues = {
    tier1SpecialPayout: tier1,
    tier2SpecialPayout: tier2,
    tier3SpecialPayout: tier3,
  };

  const tierSetters = {
    tier1SpecialPayout: setTier1,
    tier2SpecialPayout: setTier2,
    tier3SpecialPayout: setTier3,
  };

  async function handleSave() {
    setLoading(true);
    setError(null);

    if (enabled) {
      const parsed = {
        tier1: parseFloat(tier1),
        tier2: parseFloat(tier2),
        tier3: parseFloat(tier3),
      };
      if (
        !Number.isFinite(parsed.tier1) ||
        !Number.isFinite(parsed.tier2) ||
        !Number.isFinite(parsed.tier3) ||
        parsed.tier1 < 0 ||
        parsed.tier2 < 0 ||
        parsed.tier3 < 0
      ) {
        setError("Enter a valid minimum payout for each tier.");
        setLoading(false);
        return;
      }
    }

    const body = enabled
      ? {
          useSpecialTierPayouts: true,
          tier1SpecialPayout: parseFloat(tier1),
          tier2SpecialPayout: parseFloat(tier2),
          tier3SpecialPayout: parseFloat(tier3),
        }
      : { useSpecialTierPayouts: false };

    const res = await fetch(`/api/v1/admin/publishers/${publisherId}/special-payout`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save special payout");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {openProp === undefined && (
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              Special payout
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Special payout — {publisherName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a different minimum publisher payout per country tier for Smart Link rotation.
            This filters which campaigns appear in the publisher&apos;s Smart Link — it does not
            change the amount credited when a lead is paid.
          </p>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--theme-primary)]"
            />
            Enable tier special payouts
          </label>

          <div className="space-y-3">
            {TIER_FIELDS.map(({ key, row }) => (
              <div
                key={key}
                className="rounded-xl border border-border bg-muted/50 p-4"
              >
                <p className="mb-2 text-sm font-semibold text-foreground">
                  {row.label} — {row.countries}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Minimum payout (USD per lead)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tierValues[key]}
                    disabled={!enabled}
                    onChange={(e) => tierSetters[key](e.target.value)}
                    placeholder="e.g. 1.50"
                  />
                  {settings[key] != null && (
                    <p className="text-xs text-muted-foreground">
                      Current: {formatCurrency(settings[key]!)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="bg-[var(--theme-primary)] hover:opacity-90"
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
