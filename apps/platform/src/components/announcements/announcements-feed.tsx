import { Bell, Gift, Megaphone, Play, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnnouncementTone } from "@prisma/client";

export type AnnouncementFeedItem = {
  id: string;
  title: string;
  body: string;
  iconKey: string | null;
  tone: AnnouncementTone;
  publishedAt: string | null;
  createdAt?: string;
};

export const ANNOUNCEMENT_TONE_STYLES: Record<
  AnnouncementTone,
  {
    accent: string;
    chip: string;
    icon: string;
    badge: string;
    badgeText: string;
    label: string;
    /** admin table / form color swatch */
    swatchBg: string;
  }
> = {
  VIOLET: {
    accent: "border-l-violet-500",
    chip: "bg-violet-50",
    icon: "text-violet-600",
    badge: "bg-violet-50 text-violet-700",
    badgeText: "Update",
    label: "Violet",
    swatchBg: "bg-violet-500",
  },
  EMERALD: {
    accent: "border-l-[var(--theme-success)]",
    chip: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)]",
    icon: "text-[var(--theme-success)]",
    badge: "bg-[color-mix(in_srgb,var(--theme-success)_12%,white)] text-[var(--theme-success)]",
    badgeText: "New",
    label: "Emerald",
    swatchBg: "bg-emerald-500",
  },
  BLUE: {
    accent: "border-l-[var(--theme-primary)]",
    chip: "bg-[var(--theme-primary-soft)]",
    icon: "text-[var(--theme-primary)]",
    badge: "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
    badgeText: "Info",
    label: "Blue",
    swatchBg: "bg-[var(--theme-primary)]",
  },
  AMBER: {
    accent: "border-l-[var(--warning)]",
    chip: "bg-[color-mix(in_srgb,var(--warning)_14%,white)]",
    icon: "text-[var(--warning)]",
    badge: "bg-[color-mix(in_srgb,var(--warning)_14%,white)] text-[var(--warning)]",
    badgeText: "Alert",
    label: "Amber",
    swatchBg: "bg-amber-500",
  },
};

const TONE_DEFAULT_ICONS: Record<AnnouncementTone, LucideIcon> = {
  VIOLET: Sparkles,
  EMERALD: Bell,
  BLUE: Megaphone,
  AMBER: Wrench,
};

const ICON_BY_KEY: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  gift: Gift,
  play: Play,
  sparkles: Sparkles,
  wrench: Wrench,
  bell: Bell,
};

export const ANNOUNCEMENT_ICON_OPTIONS = [
  { value: "megaphone", label: "Megaphone" },
  { value: "bell", label: "Bell" },
  { value: "sparkles", label: "Sparkles" },
  { value: "gift", label: "Gift" },
  { value: "play", label: "Play" },
  { value: "wrench", label: "Wrench" },
] as const;

export function announcementIcon(tone: AnnouncementTone, iconKey?: string | null): LucideIcon {
  if (iconKey && ICON_BY_KEY[iconKey]) return ICON_BY_KEY[iconKey];
  return TONE_DEFAULT_ICONS[tone];
}

export function formatAnnouncementDate(iso: string | null | undefined) {
  if (!iso) return "Unpublished";
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AnnouncementListItem({ item }: { item: AnnouncementFeedItem }) {
  const Icon = announcementIcon(item.tone, item.iconKey);
  const styles = ANNOUNCEMENT_TONE_STYLES[item.tone];
  const date = formatAnnouncementDate(item.publishedAt ?? item.createdAt);

  return (
    <li
      className={cn(
        "rounded-[var(--radius-card,0.875rem)] border border-border border-l-[3px] bg-card p-4 shadow-[var(--shadow-card)]",
        styles.accent,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            styles.chip,
          )}
        >
          <Icon className={cn("h-[18px] w-[18px]", styles.icon)} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                styles.badge,
              )}
            >
              {styles.badgeText}
            </span>
            <span
              suppressHydrationWarning
              className="text-[11px] font-medium tracking-normal text-muted-foreground"
            >
              {date}
            </span>
          </div>

          <p className="text-sm font-semibold leading-snug tracking-normal text-foreground">
            {item.title}
          </p>

          {item.body ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed tracking-normal text-muted-foreground">
              {item.body}
            </p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function AnnouncementsFeed({
  items,
  emptyLabel = "No announcements yet.",
}: {
  items: AnnouncementFeedItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <AnnouncementListItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
