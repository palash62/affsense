"use client";

import { Download } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LeadExportButton() {
  const searchParams = useSearchParams();
  const href = `/api/v1/leads/export?${searchParams.toString()}`;

  return (
    <a
      href={href}
      download
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "inline-flex h-8 items-center gap-1.5 rounded-md border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted",
      )}
    >
      <Download className="h-3.5 w-3.5" />
      Download CSV
    </a>
  );
}
