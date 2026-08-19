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
    gradient: string;
    badge: string;
    badgeText: string;
    iconRing: string;
    datePill: string;
    label: string;
    /** admin table / form color swatch */
    swatchBg: string;
  }
> = {
  VIOLET: {
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    badge: "bg-white/20 text-white",
    badgeText: "Update",
    iconRing: "bg-white/20",
    datePill: "bg-white/15 text-white/90",
    label: "Violet",
    swatchBg: "bg-violet-500",
  },
  EMERALD: {
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    badge: "bg-white/20 text-white",
    badgeText: "New",
    iconRing: "bg-white/20",
    datePill: "bg-white/15 text-white/90",
    label: "Emerald",
    swatchBg: "bg-emerald-500",
  },
  BLUE: {
    gradient: "from-[var(--theme-primary)] via-blue-600 to-indigo-600",
    badge: "bg-white/20 text-white",
    badgeText: "Info",
    iconRing: "bg-white/20",
    datePill: "bg-white/15 text-white/90",
    label: "Blue",
    swatchBg: "bg-[var(--theme-primary)]",
  },
  AMBER: {
    gradient: "from-amber-500 via-orange-500 to-rose-500",
    badge: "bg-white/20 text-white",
    badgeText: "Alert",
    iconRing: "bg-white/20",
    datePill: "bg-white/15 text-white/90",
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
        "relative overflow-hidden rounded-2xl bg-gradient-to-r p-4 shadow-md",
        styles.gradient,
      )}
    >
      {/* decorative background circle */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-6 right-12 h-20 w-20 rounded-full bg-white/5" />

      <div className="relative flex items-start gap-3">
        {/* icon */}
        <span
          className={cn(
            "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
            styles.iconRing,
          )}
        >
          <Icon className="h-5 w-5 text-white" />
        </span>

        <div className="min-w-0 flex-1">
          {/* badge + date row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                styles.badge,
              )}
            >
              {styles.badgeText}
            </span>
            <span
              suppressHydrationWarning
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                styles.datePill,
              )}
            >
              {date}
            </span>
          </div>

          <p className="text-sm font-bold leading-snug text-white">{item.title}</p>

          {item.body ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/80">
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
