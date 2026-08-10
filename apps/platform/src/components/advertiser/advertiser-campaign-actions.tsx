"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  Crosshair,
  FlaskConical,
  MoreHorizontal,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import type { CampaignStatus } from "@prisma/client";
import { canAdminDeleteCampaign, getAllowedStatusTransitions } from "@/lib/campaign-lifecycle";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { CampaignTrackingPixelPanel } from "@/components/advertiser/campaign-tracking-pixel-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { SHOW_CAMPAIGN_TRACKING_PIXEL_UI } from "@/lib/campaign-pixel-ui";
import { cn } from "@/lib/utils";

export function AdvertiserCampaignActions({
  campaign,
}: {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    leadCount: number;
    funnelSlug: string | null;
    pixelToken?: string | null;
  };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pixelOpen, setPixelOpen] = useState(false);
  const [pixelToken, setPixelToken] = useState(campaign.pixelToken ?? null);
  const [pixelLoading, setPixelLoading] = useState(false);

  const lifecycle = { status: campaign.status, leadCount: campaign.leadCount };
  const canDelete = canAdminDeleteCampaign(lifecycle);
  const transitions = getAllowedStatusTransitions(campaign.status).filter(
    (s) => s === "PAUSED" || s === "ACTIVE",
  );

  useEffect(() => {
    setPixelToken(campaign.pixelToken ?? null);
  }, [campaign.pixelToken]);

  useEffect(() => {
    if (!pixelOpen || pixelToken) return;

    let cancelled = false;
    setPixelLoading(true);

    fetch(`/api/v1/campaigns/${campaign.id}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) {
          setPixelToken(body?.data?.pixelToken ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setPixelLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pixelOpen, pixelToken, campaign.id]);

  async function patchStatus(status: CampaignStatus) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update campaign");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/campaigns/${campaign.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to delete campaign");
      return;
    }
    setDeleteOpen(false);
    router.refresh();
  }

  function openTestFunnel() {
    if (!campaign.funnelSlug) return;
    window.open(
      `/o/${campaign.funnelSlug}?test_campaign=${campaign.id}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <>
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        <ButtonLink
          href={`/advertiser/campaigns/${campaign.id}`}
          variant="outline"
          size="sm"
          className="h-8 px-2.5"
        >
          View
        </ButtonLink>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2.5"
          disabled={!campaign.funnelSlug}
          title={
            campaign.funnelSlug
              ? "Open the attached funnel in campaign test mode"
              : "Attach a funnel to this campaign before testing"
          }
          onClick={openTestFunnel}
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Test
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 w-8 px-0")}
            aria-label="More campaign actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => router.push(`/advertiser/campaigns/${campaign.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {SHOW_CAMPAIGN_TRACKING_PIXEL_UI ? (
              <DropdownMenuItem onClick={() => setPixelOpen(true)}>
                <Crosshair className="mr-2 h-4 w-4" />
                Tracking pixel
              </DropdownMenuItem>
            ) : null}
            {transitions.includes("PAUSED") && campaign.status === "ACTIVE" ? (
              <DropdownMenuItem disabled={loading} onClick={() => patchStatus("PAUSED")}>
                <Ban className="mr-2 h-4 w-4" />
                Pause
              </DropdownMenuItem>
            ) : null}
            {transitions.includes("ACTIVE") && campaign.status === "PAUSED" ? (
              <DropdownMenuItem disabled={loading} onClick={() => patchStatus("ACTIVE")}>
                <Play className="mr-2 h-4 w-4" />
                Resume
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              disabled={!canDelete}
              title={
                canDelete
                  ? undefined
                  : "Only draft/pending campaigns with no leads can be deleted"
              }
              onClick={() => {
                if (!canDelete) return;
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error && !deleteOpen ? (
        <p className="mt-1 text-right text-xs text-red-600">{error}</p>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete campaign</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{campaign.name}</strong>? This cannot be undone.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={loading} onClick={handleDelete}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {SHOW_CAMPAIGN_TRACKING_PIXEL_UI && pixelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setPixelOpen(false)}
          />
          <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Tracking pixel
                </p>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{campaign.name}</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => setPixelOpen(false)}
              >
                Close
              </Button>
            </div>
            {pixelLoading ? <p className="text-sm text-muted-foreground">Loading pixel...</p> : null}
            {!pixelLoading && pixelToken ? (
              <CampaignTrackingPixelPanel pixelToken={pixelToken} compact />
            ) : null}
            {!pixelLoading && !pixelToken ? (
              <p className="text-sm text-red-600">Unable to load tracking pixel for this campaign.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
