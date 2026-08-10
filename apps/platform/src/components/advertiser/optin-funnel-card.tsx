"use client";

import { Eye, LayoutTemplate, Pencil, Trash2 } from "lucide-react";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import { DEFAULT_THEME } from "@/modules/page-builder/lib/theme";
import { OptinFunnelCraftThumbnail } from "@/components/advertiser/optin-funnel-craft-thumbnail";
import { funnelCraftPreviewRevision } from "@/components/optin/funnel-craft-preview-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  funnelHasOptinPreview,
  toFunnelWorkflowEntityFromFunnel,
} from "@/components/advertiser/funnel/funnel-types";

export function OptinFunnelCard({
  funnel,
  onArchive,
}: {
  funnel: SerializedOptinFunnel;
  onArchive: (id: string) => void;
}) {
  const entity = toFunnelWorkflowEntityFromFunnel(funnel);
  const showPreview = funnelHasOptinPreview(funnel);
  const themeJson = entity.themeJson ?? DEFAULT_THEME;
  const thumbnailRevision = funnelCraftPreviewRevision(entity.craftState?.craft, themeJson);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
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
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="font-semibold text-foreground">{funnel.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">/o/{funnel.slug}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/advertiser/optin-funnels/${funnel.id}`} size="sm" variant="outline">
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </ButtonLink>
          <a
            href={`/o/${funnel.slug}?preview=1&frame=1`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </a>
          <Button size="sm" variant="outline" className="text-red-600" onClick={() => onArchive(funnel.id)}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Archive
          </Button>
        </div>
      </div>
    </div>
  );
}
