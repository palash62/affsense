"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { soloRequest } from "@/components/solo-ads/solo-ui";

export function SoloRefundClickButton({ clickId, amountLabel }: { clickId: string; amountLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refund() {
    const reason = window.prompt(`Refund ${amountLabel} to the affiliate's ad wallet? Enter a reason (required):`);
    if (!reason?.trim()) return;
    setBusy(true);
    try {
      await soloRequest(`/api/v1/admin/solo-ads/clicks/${clickId}/refund`, { body: { reason: reason.trim() } });
      toast.success("Click refunded");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={refund}>
      {busy ? "Refunding..." : "Refund"}
    </Button>
  );
}
