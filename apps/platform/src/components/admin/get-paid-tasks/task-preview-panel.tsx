"use client";

import { Heart, ThumbsUp, PlayCircle, ExternalLink, MousePointerClick } from "lucide-react";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import type { GetPaidTaskFormValues } from "./mock-data";

function PreviewIcon({ action }: { action: string }) {
  const a = action.toLowerCase();
  if (a.includes("subscribe") || a.includes("youtube")) {
    return <PlayCircle className="h-5 w-5 text-red-500" />;
  }
  if (a.includes("like") || a.includes("facebook")) {
    return <ThumbsUp className="h-5 w-5 text-blue-600" />;
  }
  if (a.includes("follow") || a.includes("share") || a.includes("instagram")) {
    return <Heart className="h-5 w-5 text-pink-600" />;
  }
  return <MousePointerClick className="h-5 w-5 text-[var(--theme-primary)]" />;
}

export function TaskPreviewPanel({ values }: { values: GetPaidTaskFormValues }) {
  const reward = Number.parseFloat(values.rewardAmount) || 0;
  const title = values.title.trim() || "Untitled task";
  const description =
    values.descriptionText.trim() || "Provide clear instructions to complete this task...";
  const cta = values.requiredAction || "Follow";

  return (
    <DashboardCard>
      <DashboardCardTitle>Task Preview</DashboardCardTitle>
      <div className="mt-4 rounded-[var(--radius-card,0.875rem)] border border-[color-mix(in_srgb,var(--theme-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--theme-success)_8%,white)] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
            <PreviewIcon action={values.requiredAction || values.taskType} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <span className="shrink-0 text-sm font-bold text-[var(--theme-success)]">
                ${reward.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 items-center rounded-md bg-[var(--theme-primary)] px-3 text-xs font-semibold text-white">
                {cta}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--theme-primary)]">
                View Details
                <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
