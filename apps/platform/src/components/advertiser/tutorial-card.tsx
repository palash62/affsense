"use client";

import { Play, Video } from "lucide-react";
import type { SerializedTutorial } from "@/services/tutorial.service";
import { cn } from "@/lib/utils";

type TutorialCardProps = {
  tutorial: SerializedTutorial;
  onPlay: (tutorial: SerializedTutorial) => void;
};

export function TutorialCard({ tutorial, onPlay }: TutorialCardProps) {
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-lg",
      )}
    >
      <button
        type="button"
        onClick={() => onPlay(tutorial)}
        className="relative block aspect-video w-full overflow-hidden bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--theme-primary)]/50"
        aria-label={`Play tutorial: ${tutorial.title}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tutorial.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-[var(--theme-primary)] shadow-xl ring-4 ring-white/30 transition duration-200 group-hover:scale-110">
            <Play className="ml-1 h-6 w-6 fill-current" />
          </span>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
          <Video className="h-3 w-3" />
          Watch tutorial
        </div>
      </button>

      <div className="relative border-t border-border bg-gradient-to-br from-white via-slate-50/80 to-[color-mix(in_srgb,var(--theme-primary)_6%,white)] px-5 py-5">
        <div
          className="absolute left-0 top-0 h-full w-1 bg-[var(--theme-primary)]"
          aria-hidden
        />
        <div className="pl-2">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--theme-primary)]">
            Tutorial
          </p>
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight text-foreground">
            {tutorial.title}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {tutorial.description}
          </p>
        </div>
      </div>
    </article>
  );
}
