"use client";

import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import { DEFAULT_THEME } from "@/modules/page-builder/lib/theme";
import { OptinFunnelCraftThumbnail } from "@/components/advertiser/optin-funnel-craft-thumbnail";
import { funnelCraftPreviewRevision } from "@/components/optin/funnel-craft-preview-frame";
import { Badge } from "@/components/ui/badge";
import { FunnelRowActions } from "./funnel-row-actions";
import {
  formatFunnelDate,
  funnelHasOptinPreview,
  funnelStepCount,
  toFunnelWorkflowEntityFromFunnel,
} from "./funnel-types";

type FunnelCardProps = {
  funnel: SerializedOptinFunnel;
  duplicating?: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
};

export function FunnelCard({ funnel, duplicating, onDuplicate, onArchive }: FunnelCardProps) {
  const router = useRouter();
  const steps = funnelStepCount(funnel.thankYouEnabled);
  const entity = toFunnelWorkflowEntityFromFunnel(funnel);
  const showPreview = funnelHasOptinPreview(funnel);
  const themeJson = entity.themeJson ?? DEFAULT_THEME;
  const thumbnailRevision = funnelCraftPreviewRevision(entity.craftState?.craft, themeJson);

  return (
    <div className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:border-border hover:shadow-md">
      <div
        role="button"
        tabIndex={0}
        onClick={() => router.push(`/advertiser/optin-funnels/${funnel.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/advertiser/optin-funnels/${funnel.id}`);
          }
        }}
        className="relative aspect-[16/10] cursor-pointer overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
      >
        {showPreview && entity.craftState ? (
          <OptinFunnelCraftThumbnail
            key={thumbnailRevision}
            craftState={entity.craftState}
            themeJson={themeJson}
            scale={0.28}
            emptyFallback="none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-100 to-slate-200 px-4 text-center">
            <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
            <span className="line-clamp-2 text-sm font-medium text-muted-foreground">{funnel.name}</span>
          </div>
        )}

        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          <Badge variant={funnel.isPublished ? "default" : "secondary"}>
            {funnel.isPublished ? "Published" : "Draft"}
          </Badge>
          {funnel.thankYouEnabled && (
            <Badge variant="outline" className="border-emerald-200 bg-white/95 text-emerald-700">
              Thank you page
            </Badge>
          )}
        </div>

        <div className="absolute right-2 top-2 z-20" onClick={(e) => e.stopPropagation()}>
          <FunnelRowActions
            funnelId={funnel.id}
            slug={funnel.slug}
            duplicating={duplicating}
            onDuplicate={onDuplicate}
            onArchive={onArchive}
          />
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="font-semibold text-foreground">{funnel.name}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">/o/{funnel.slug}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Updated {formatFunnelDate(funnel.updatedAt)} · {steps} step{steps === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}
