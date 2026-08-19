"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { SerializedAnnouncement } from "@/services/announcement.service";
import {
  ANNOUNCEMENT_ICON_OPTIONS,
  ANNOUNCEMENT_TONE_STYLES,
  AnnouncementListItem,
} from "@/components/announcements/announcements-feed";
import type { AnnouncementAudience, AnnouncementTone, PublisherAnnouncementStatus } from "@prisma/client";

export type AnnouncementFormValues = {
  title: string;
  body: string;
  iconKey: string;
  audience: AnnouncementAudience;
  tone: AnnouncementTone;
  status: PublisherAnnouncementStatus;
};

const emptyValues: AnnouncementFormValues = {
  title: "",
  body: "",
  iconKey: "megaphone",
  audience: "BOTH",
  tone: "BLUE",
  status: "PUBLISHED",
};

const AUDIENCE_OPTIONS: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: "ADVERTISER", label: "Advertisers" },
  { value: "PUBLISHER", label: "Affiliates" },
  { value: "BOTH", label: "Both" },
];

const TONES: AnnouncementTone[] = ["VIOLET", "EMERALD", "BLUE", "AMBER"];

export function AnnouncementFormDialog({
  open,
  onOpenChange,
  loading,
  announcement,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  announcement?: SerializedAnnouncement | null;
  onSubmit: (values: AnnouncementFormValues) => void;
}) {
  const [values, setValues] = useState<AnnouncementFormValues>(emptyValues);
  const isEdit = Boolean(announcement);

  useEffect(() => {
    if (!open) return;
    if (announcement) {
      setValues({
        title: announcement.title,
        body: announcement.body,
        iconKey: announcement.iconKey ?? "megaphone",
        audience: announcement.audience,
        tone: announcement.tone,
        status: announcement.status,
      });
    } else {
      setValues(emptyValues);
    }
  }, [open, announcement]);

  const canSubmit = values.title.trim().length >= 2 && values.body.trim().length >= 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit announcement" : "New announcement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="announcement-title">Title</Label>
            <Input
              id="announcement-title"
              value={values.title}
              onChange={(e) => setValues((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="New CPA marketplace features"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="announcement-body">Body</Label>
            <Textarea
              id="announcement-body"
              value={values.body}
              onChange={(e) => setValues((prev) => ({ ...prev, body: e.target.value }))}
              placeholder="What should advertisers or affiliates know?"
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Audience</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, audience: option.value }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    values.audience === option.value
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => {
                const style = ANNOUNCEMENT_TONE_STYLES[tone];
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setValues((prev) => ({ ...prev, tone }))}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm",
                      values.tone === tone
                        ? "border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20"
                        : "border-border",
                    )}
                  >
                    <span className={cn("h-4 w-4 rounded-md", style.swatchBg, "ring-1 ring-black/5")} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ANNOUNCEMENT_ICON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, iconKey: option.value }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    values.iconKey === option.value
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["PUBLISHED", "DRAFT"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setValues((prev) => ({ ...prev, status }))}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm",
                    values.status === status
                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  {status === "PUBLISHED" ? "Published" : "Draft"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dashboard preview
            </p>
            <ul>
              <AnnouncementListItem
                item={{
                  id: "preview",
                  title: values.title.trim() || "Announcement title",
                  body: values.body.trim() || "Announcement body",
                  iconKey: values.iconKey,
                  tone: values.tone,
                  publishedAt: new Date().toISOString(),
                }}
              />
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSubmit || loading} onClick={() => onSubmit(values)}>
              {loading ? "Saving..." : isEdit ? "Save changes" : "Create announcement"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
