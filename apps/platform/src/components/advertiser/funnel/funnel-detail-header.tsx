"use client";

import { Share2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FunnelDetailHeaderProps = {
  funnelName: string;
  backHref?: string;
  statusLabel?: string;
  statusClassName?: string;
};

export function FunnelDetailHeader({
  funnelName,
  backHref = "/advertiser/optin-funnels",
  statusLabel,
  statusClassName,
}: FunnelDetailHeaderProps) {
  return (
    <PageHeader
      title={funnelName}
      badge={
        statusLabel ? (
          <span
            className={
              statusClassName ??
              "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {statusLabel}
          </span>
        ) : undefined
      }
      breadcrumbs={[
        { label: "Advertiser", href: "/advertiser" },
        { label: "Funnels", href: backHref },
        { label: funnelName },
      ]}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground opacity-50"
            disabled
          >
            <Share2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </PageHeader>
  );
}
