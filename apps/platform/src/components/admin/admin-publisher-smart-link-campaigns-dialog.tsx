"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type SmartLinkAllowlistCampaign = {
  id: string;
  name: string;
  advertiserName: string;
};

type AdminPublisherSmartLinkCampaignsDialogProps = {
  publisherId: string;
  publisherName: string;
  restrictSmartLinkCampaigns: boolean;
  selectedCampaignIds: string[];
  campaigns: SmartLinkAllowlistCampaign[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AdminPublisherSmartLinkCampaignsDialog({
  publisherId,
  publisherName,
  restrictSmartLinkCampaigns,
  selectedCampaignIds,
  campaigns,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: AdminPublisherSmartLinkCampaignsDialogProps) {
  const router = useRouter();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  function setOpen(next: boolean) {
    setOpenInternal(next);
    onOpenChangeProp?.(next);
  }
  const [enabled, setEnabled] = useState(restrictSmartLinkCampaigns);
  const [selected, setSelected] = useState<string[]>(selectedCampaignIds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleCampaign(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((campaignId) => campaignId !== id) : [...prev, id],
    );
  }

  async function handleSave() {
    setLoading(true);
    setError(null);

    if (enabled && selected.length === 0) {
      setError("Select at least one campaign.");
      setLoading(false);
      return;
    }

    const res = await fetch(`/api/v1/admin/publishers/${publisherId}/smart-link-campaigns`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restrictSmartLinkCampaigns: enabled,
        campaignIds: enabled ? selected : [],
      }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save Smart Link campaigns");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setEnabled(restrictSmartLinkCampaigns);
          setSelected(selectedCampaignIds);
          setError(null);
        }
      }}
    >
      {openProp === undefined && (
        <DialogTrigger
          render={
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Link2 className="h-3.5 w-3.5" />
              Smart Link campaigns
            </Button>
          }
        />
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Smart Link campaigns — {publisherName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Leave this off to keep the current Smart Link rotation. Turn it on only when this
            publisher should rotate a selected subset of active campaigns.
          </p>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-[var(--theme-primary)]"
            />
            Restrict Smart Link campaigns
          </label>

          <div
            className={cn(
              "max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2",
              !enabled && "pointer-events-none opacity-50",
            )}
          >
            {campaigns.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">No active campaigns</p>
            ) : (
              campaigns.map((campaign) => {
                const checked = selectedSet.has(campaign.id);
                return (
                  <label
                    key={campaign.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm",
                      checked ? "bg-emerald-50/70" : "hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!enabled}
                      onChange={() => toggleCampaign(campaign.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[var(--theme-primary)]"
                    />
                    <span>
                      <span className="font-medium text-slate-900">{campaign.name}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {campaign.advertiserName}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
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
            onClick={() => void handleSave()}
            className="bg-[var(--theme-primary)] hover:opacity-90"
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
