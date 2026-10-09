"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { soloRequest } from "@/components/solo-ads/solo-ui";

export function SoloWiseDepositReview({
  depositId,
  amountCents,
  publisherName,
  reference,
}: {
  depositId: string;
  amountCents: number;
  publisherName: string;
  reference: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [amount, setAmount] = useState((amountCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "approve") {
        await soloRequest(`/api/v1/admin/solo-ads/deposits/${depositId}/approve`, { body: { amount: Number(amount) } });
        toast.success(`$${Number(amount).toFixed(2)} added to ${publisherName}'s ad wallet`);
      } else {
        await soloRequest(`/api/v1/admin/solo-ads/deposits/${depositId}/reject`, { body: { reason } });
        toast.success("Deposit rejected");
      }
      setMode(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex justify-end gap-2">
      <Button size="sm" onClick={() => setMode("approve")}>
        Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => setMode("reject")}>
        Reject
      </Button>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "Approve Wise deposit" : "Reject Wise deposit"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {publisherName} reported ${(amountCents / 100).toFixed(2)} with Wise reference <strong>{reference}</strong>. Check that
              the payment arrived in your Wise account before approving.
            </p>
            {mode === "approve" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`wise-credit-${depositId}`}>Amount to credit (USD)</Label>
                <Input
                  id={`wise-credit-${depositId}`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(amountCents / 100).toFixed(2)}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Lower this if less arrived after transfer fees.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor={`wise-reject-${depositId}`}>Reason (shown to the affiliate)</Label>
                <textarea
                  id={`wise-reject-${depositId}`}
                  required
                  minLength={5}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMode(null)}>
                Cancel
              </Button>
              <Button type="submit" variant={mode === "reject" ? "destructive" : "default"} disabled={busy}>
                {busy ? "Saving..." : mode === "approve" ? "Approve and credit" : "Reject deposit"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
