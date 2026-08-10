"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AdvertiserBlockPublisherButton({
  publisherId,
  blocked,
}: {
  publisherId: string;
  blocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(blocked);

  async function handleBlock() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advertiser/publisher-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publisherId }),
      });
      if (res.ok) {
        setIsBlocked(true);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUnblock() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/advertiser/publisher-blocks?publisherId=${encodeURIComponent(publisherId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setIsBlocked(false);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  if (isBlocked) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleUnblock}
        disabled={loading}
        className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
        Unblock
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-border text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Ban className="h-3.5 w-3.5" />
        Block
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block publisher</DialogTitle>
          <DialogDescription>
            Block publisher <strong className="font-mono">{publisherId.slice(-8).toUpperCase()}</strong> from
            all your campaigns? They will no longer receive traffic from their Smart Link to your
            offers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleBlock}
            disabled={loading}
            className="bg-red-600 hover:bg-red-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block publisher"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
