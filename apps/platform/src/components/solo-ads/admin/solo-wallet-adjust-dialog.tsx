"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { soloRequest } from "@/components/solo-ads/solo-ui";

export function SoloWalletAdjustDialog({ publisherId, publisherName }: { publisherId: string; publisherName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await soloRequest("/api/v1/admin/solo-ads/wallets/adjust", {
        body: { publisherId, amount: Number(amount), reason, requestKey },
      });
      toast.success("Wallet adjusted");
      setOpen(false);
      setAmount("");
      setReason("");
      setRequestKey(crypto.randomUUID());
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Adjust</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust advertising wallet: {publisherName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use a positive amount to credit and a negative amount to debit. Every adjustment is recorded in the ledger and audit
            log.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="adj-amount">Amount (USD)</Label>
            <Input id="adj-amount" type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.00 or -10.00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <textarea
              id="adj-reason"
              required
              minLength={5}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Apply adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
