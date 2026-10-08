"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { soloRequest } from "@/components/solo-ads/solo-ui";

export function SoloCampaignActions({ id, status, adminPaused }: { id: string; status: string; adminPaused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "submit" | "pause" | "resume" | "delete") {
    if (action === "delete" && !window.confirm("Delete this draft?")) return;
    setBusy(true);
    try {
      if (action === "delete") {
        await soloRequest(`/api/v1/publisher/solo-ads/campaigns/${id}`, { method: "DELETE" });
        toast.success("Draft deleted");
        router.push("/publisher/solo-ads/campaigns");
      } else {
        await soloRequest(`/api/v1/publisher/solo-ads/campaigns/${id}/status`, { body: { action } });
        toast.success(action === "submit" ? "Submitted for review" : action === "pause" ? "Campaign paused" : "Campaign resumed");
      }
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "COMPLETED" ? (
        <ButtonLink href={`/publisher/solo-ads/campaigns/${id}/edit`} variant="outline" size="sm">
          Edit
        </ButtonLink>
      ) : null}
      {["DRAFT", "REJECTED"].includes(status) ? (
        <Button size="sm" disabled={busy} onClick={() => act("submit")}>
          Submit for review
        </Button>
      ) : null}
      {["ACTIVE", "INSUFFICIENT_FUNDS", "BUDGET_EXHAUSTED"].includes(status) ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => act("pause")}>
          Pause
        </Button>
      ) : null}
      {status === "PAUSED" && !adminPaused ? (
        <Button size="sm" disabled={busy} onClick={() => act("resume")}>
          Resume
        </Button>
      ) : null}
      {status === "DRAFT" ? (
        <Button size="sm" variant="ghost" className="text-red-600" disabled={busy} onClick={() => act("delete")}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}
