"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AffiliateInvoiceDownloadButton({
  href,
  label = "Download",
  size = "sm",
  variant = "outline",
  className,
  stopPropagation = false,
}: {
  href: string;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "ghost" | "default";
  className?: string;
  /** When true, prevent parent row click handlers (e.g. expand/collapse). */
  stopPropagation?: boolean;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className ?? "h-8 gap-1"}
      onClick={(event) => {
        if (stopPropagation) {
          event.stopPropagation();
        }
        const url = href.includes("?") ? `${href}&print=1` : `${href}?print=1`;
        window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
