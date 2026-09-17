"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { TutorialCard } from "@/components/advertiser/tutorial-card";
import { TutorialVideoPlayer } from "@/components/advertiser/tutorial-video-player";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getYouTubeEmbedUrlFromLink } from "@/lib/youtube";
import type { SerializedTutorial } from "@/services/tutorial.service";

type TutorialsPanelProps = {
  tutorials: SerializedTutorial[];
};

export function TutorialsPanel({ tutorials }: TutorialsPanelProps) {
  const [search, setSearch] = useState("");
  const [activeTutorial, setActiveTutorial] = useState<SerializedTutorial | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tutorials;
    return tutorials.filter(
      (tutorial) =>
        tutorial.title.toLowerCase().includes(q) ||
        tutorial.description.toLowerCase().includes(q),
    );
  }, [tutorials, search]);

  const embedUrl = activeTutorial
    ? getYouTubeEmbedUrlFromLink(activeTutorial.youtubeUrl, { autoplay: true, controls: true })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} tutorial{filtered.length === 1 ? "" : "s"}
          {search.trim() ? ` matching "${search.trim()}"` : " available"}
        </p>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tutorials..."
            className="h-10 pl-9 pr-9"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-muted-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {tutorials.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/80 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tutorials available yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Check back later for new video guides.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/80 px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">No tutorials found</p>
          <p className="mt-1 text-xs text-muted-foreground">Try a different search term.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((tutorial) => (
            <TutorialCard key={tutorial.id} tutorial={tutorial} onPlay={setActiveTutorial} />
          ))}
        </div>
      )}

      <Dialog open={Boolean(activeTutorial)} onOpenChange={(open) => !open && setActiveTutorial(null)}>
        <DialogContent
          showCloseButton
          className="max-w-4xl gap-0 overflow-hidden border-0 bg-slate-950 p-0 text-white sm:max-w-4xl [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:bg-white/10"
        >
          {activeTutorial && embedUrl ? (
            <>
              <DialogTitle className="sr-only">{activeTutorial.title}</DialogTitle>
              <TutorialVideoPlayer
                key={activeTutorial.id}
                embedUrl={embedUrl}
                title={activeTutorial.title}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
