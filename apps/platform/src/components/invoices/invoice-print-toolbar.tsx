"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser print dialog shortly after load when `?print=1` is present. */
export function InvoicePrintTrigger() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") !== "1") return;
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}

export function InvoicePrintToolbar() {
  return (
    <div className="invoice-print-toolbar sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur print:hidden">
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => window.close()}>
        <X className="h-3.5 w-3.5" />
        Close
      </Button>
      <Button type="button" size="sm" className="gap-1.5" onClick={() => window.print()}>
        <Download className="h-3.5 w-3.5" />
        Download PDF
      </Button>
    </div>
  );
}
