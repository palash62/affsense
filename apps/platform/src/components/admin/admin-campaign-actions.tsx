"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, FlaskConical, Pencil, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CampaignStatus } from "@prisma/client";
import {
  canAdminDeleteCampaign,
  canAdminEditCampaign,
  getAllowedStatusTransitions,
} from "@/lib/campaign-lifecycle";

interface AdminCampaignActionsProps {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    leadCount: number;
    funnelSlug: string | null;
  };
}

export function AdminCampaignActions({ campaign }: AdminCampaignActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const lifecycle = { status: campaign.status, leadCount: campaign.leadCount };
  const canEdit = canAdminEditCampaign(lifecycle);
  const canDelete = canAdminDeleteCampaign(lifecycle);
  const isRunning = campaign.status === "ACTIVE" || campaign.status === "PAUSED";
  const transitions = getAllowedStatusTransitions(campaign.status).filter(
    (s) => s === "PAUSED" || s === "ACTIVE" || s === "ARCHIVED",
  );
  const deleteBlockedReason = isRunning
    ? "Running campaign cannot be deleted"
    : campaign.leadCount > 0
      ? "Campaigns with leads cannot be deleted"
      : "Only draft or pending campaigns can be deleted";

  async function patchStatus(status: CampaignStatus) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
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
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to delete campaign");
      return;
    }
    setDeleteOpen(false);
    router.push("/admin/campaigns");
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1"
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
      {canEdit && (
        <ButtonLink
          href={`/admin/campaigns/${campaign.id}/edit`}
          variant="outline"
          size="sm"
          className="h-8 gap-1"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </ButtonLink>
      )}
      {transitions.includes("PAUSED") && campaign.status === "ACTIVE" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={loading}
          onClick={() => patchStatus("PAUSED")}
        >
          <Ban className="h-3.5 w-3.5" />
          Pause
        </Button>
      )}
      {transitions.includes("ACTIVE") && campaign.status === "PAUSED" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1"
          disabled={loading}
          onClick={() => patchStatus("ACTIVE")}
        >
          <Play className="h-3.5 w-3.5" />
          Resume
        </Button>
      )}
      {canDelete ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" className="h-8 gap-1 text-red-600 hover:text-red-700" />
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete campaign</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Permanently delete <strong>{campaign.name}</strong>? This cannot be undone.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={loading} onClick={handleDelete}>
                {loading ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-red-400 hover:text-red-400"
          disabled
          title={deleteBlockedReason}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </Button>
      )}
      {error && !deleteOpen && <p className="w-full text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
