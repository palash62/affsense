"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PublisherRequestInvoiceButtonProps {
  disabledReason?: string | null;
}

export function PublisherRequestInvoiceButton({ disabledReason }: PublisherRequestInvoiceButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function requestInvoice() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/publisher/invoices", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error?.message ?? "Could not request invoice");
        return;
      }
      toast.success(`Invoice ${data.data?.number ?? ""} created`.trim());
      router.refresh();
    } catch {
      toast.error("Could not request invoice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <Button
        type="button"
        onClick={requestInvoice}
        disabled={loading || Boolean(disabledReason)}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] px-5 hover:opacity-90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
        Request invoice
      </Button>
      {disabledReason ? (
        <p className="max-w-xs text-xs text-muted-foreground sm:text-right">{disabledReason}</p>
      ) : null}
    </div>
  );
}
