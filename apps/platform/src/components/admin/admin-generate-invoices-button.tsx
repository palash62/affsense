"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileStack } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type GenerateResult = {
  created: number;
  skipped: number;
  failed: number;
  totalAmount: number;
  minimumAmount: number;
};

export function AdminGenerateInvoicesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/affiliate-invoices/generate", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to generate invoices");
        return;
      }
      const data = json.data as GenerateResult;
      if (data.created === 0) {
        toast.info(
          data.skipped > 0
            ? `No invoices raised. ${data.skipped} affiliate${data.skipped === 1 ? "" : "s"} below the $${data.minimumAmount} minimum.`
            : "No uninvoiced earnings for the last completed week.",
        );
      } else {
        toast.success(
          `${data.created} invoice${data.created === 1 ? "" : "s"} raised for $${data.totalAmount.toFixed(2)}.`,
        );
      }
      if (data.failed > 0) {
        toast.error(
          `${data.failed} affiliate${data.failed === 1 ? "" : "s"} could not be invoiced. Check the server log.`,
        );
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" disabled={loading} onClick={() => void run()} className="h-10 gap-2">
      <FileStack className="h-4 w-4" />
      {loading ? "Generating…" : "Generate invoices"}
    </Button>
  );
}
