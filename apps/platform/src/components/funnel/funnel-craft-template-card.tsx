"use client";

import { useState } from "react";
import { Check, Eye, LayoutTemplate } from "lucide-react";
import { OptinFunnelCraftThumbnail } from "@/components/advertiser/optin-funnel-craft-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import { wrapCraft, formatFunnelDateShort } from "@/components/advertiser/funnel/funnel-types";
import { cn } from "@/lib/utils";

export type FunnelCraftTemplateCardProps = {
  id: string;
  name: string;
  craftState: CraftSerializedState;
  themeJson: ThemeJson;
  thankYouEnabled?: boolean;
  isPublished?: boolean;
  createdAt?: string;
  selected?: boolean;
  loading?: boolean;
  variant: "admin" | "advertiser" | "picker";
  onSelect?: () => void;
  onUse?: () => void;
  actions?: React.ReactNode;
};

function formatCreatedDate(value?: string) {
  if (!value) return null;
  return formatFunnelDateShort(value);
}

export function FunnelCraftTemplateCard({
  name,
  craftState,
  themeJson,
  thankYouEnabled,
  isPublished,
  createdAt,
  selected = false,
  loading = false,
  variant,
  onSelect,
  onUse,
  actions,
}: FunnelCraftTemplateCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const isPicker = variant === "picker";
  const isInteractive = isPicker && Boolean(onSelect);
  const createdLabel = formatCreatedDate(createdAt);

  function handleCardClick() {
    if (loading) return;
    if (isPicker) onSelect?.();
  }

  const card = (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleCardClick : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardClick();
              }
            }
          : undefined
      }
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-white text-left transition-all",
        isInteractive && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        loading && "cursor-wait opacity-80",
        selected
          ? "border-blue-600 ring-2 ring-blue-600/25 shadow-md"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        <OptinFunnelCraftThumbnail
          craftState={wrapCraft(craftState)}
          themeJson={themeJson}
          scale={0.28}
        />

        {variant === "admin" && actions && (
          <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
        )}

        {selected && isPicker && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            <Check className="h-3 w-3" />
            Selected
          </div>
        )}

        {isPicker && !selected && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-gradient-to-t from-slate-900/50 to-transparent pb-4 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow">
              Click to select
            </span>
          </div>
        )}

        {thankYouEnabled && (
          <div className="absolute bottom-3 left-3 z-10">
            <Badge variant="outline" className="border-emerald-200 bg-white/95 text-emerald-700">
              Thank you page
            </Badge>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-3">
        <p className="font-semibold text-slate-900">{name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>
            {variant === "admin" ? "System template" : "Prebuilt funnel template"}
            {createdLabel ? ` · ${createdLabel}` : ""}
          </span>
          {variant === "admin" && typeof isPublished === "boolean" ? (
            <Badge
              variant="outline"
              className={
                isPublished
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }
            >
              {isPublished ? "Published" : "Draft"}
            </Badge>
          ) : null}
        </p>

        {variant === "advertiser" && (
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                onUse?.();
              }}
            >
              <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
              Use template
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOpen(true);
              }}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {card}
      {variant === "advertiser" && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl overflow-hidden p-0">
            <DialogHeader className="border-b border-slate-100 px-6 py-4">
              <DialogTitle>{name}</DialogTitle>
            </DialogHeader>
            <div className="relative aspect-[16/10] bg-slate-100">
              <OptinFunnelCraftThumbnail
                craftState={wrapCraft(craftState)}
                themeJson={themeJson}
                scale={0.42}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
              <Button
                disabled={loading}
                onClick={() => {
                  setPreviewOpen(false);
                  onUse?.();
                }}
              >
                Use template
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
