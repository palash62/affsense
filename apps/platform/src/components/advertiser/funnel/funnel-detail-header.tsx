"use client";

import { ArrowLeft, Share2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
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
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <ButtonLink href={backHref} variant="ghost" size="sm" className="shrink-0 text-slate-600">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back
        </ButtonLink>
        <h1 className="truncate text-xl font-semibold text-slate-900">{funnelName}</h1>
        {statusLabel ? (
          <span
            className={
              statusClassName ??
              "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            }
          >
            {statusLabel}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 opacity-50"
              disabled
            >
              <Share2 className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
