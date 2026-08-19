"use client";

import { useEffect, useState } from "react";
import { Mail, PartyPopper, Send, Sparkles, Users, Wallet, X, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY =
  "cpl.advertiser.autoresponder-announcement.dismissed";

export function isAutoresponderAnnouncementDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY) === "1";
}

export function dismissAutoresponderAnnouncement(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTORESPONDER_ANNOUNCEMENT_DISMISSED_KEY, "1");
}

const FEATURE_CHIPS = [
  {
    label: "Automations",
    icon: Zap,
    className: "border-violet-200 bg-violet-50 text-violet-800",
    iconClassName: "text-violet-600",
  },
  {
    label: "Broadcasts",
    icon: Send,
    className: "border-sky-200 bg-sky-50 text-sky-800",
    iconClassName: "text-sky-600",
  },
  {
    label: "Subscriber tools",
    icon: Users,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconClassName: "text-emerald-600",
  },
] as const;

const CONFETTI_DOTS = [
  { top: "12%", left: "8%", color: "bg-fuchsia-400", size: "h-2 w-2" },
  { top: "18%", left: "22%", color: "bg-amber-400", size: "h-1.5 w-1.5" },
  { top: "10%", right: "14%", color: "bg-sky-400", size: "h-2 w-2" },
  { top: "28%", right: "8%", color: "bg-violet-400", size: "h-1.5 w-1.5" },
  { bottom: "16%", left: "12%", color: "bg-rose-400", size: "h-1.5 w-1.5" },
  { bottom: "12%", right: "18%", color: "bg-lime-400", size: "h-2 w-2" },
] as const;

export function AutoresponderAnnouncementBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!isAutoresponderAnnouncementDismissed());
  }, []);

  function handleDismiss() {
    dismissAutoresponderAnnouncement();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 p-[2px] shadow-lg shadow-fuchsia-500/20">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -top-10 h-28 w-28 rounded-full bg-white/25 blur-2xl" />
        <div className="absolute -bottom-10 right-0 h-32 w-32 rounded-full bg-sky-300/30 blur-2xl" />
        <div className="absolute right-16 top-4 h-20 w-20 rounded-full bg-amber-200/30 blur-xl" />

        {CONFETTI_DOTS.map((dot, index) => (
          <span
            key={index}
            className={cn(
              "absolute rounded-full opacity-80",
              dot.color,
              dot.size,
              index % 2 === 0 ? "animate-pulse" : "animate-bounce",
            )}
            style={{
              top: "top" in dot ? dot.top : undefined,
              left: "left" in dot ? dot.left : undefined,
              right: "right" in dot ? dot.right : undefined,
              bottom: "bottom" in dot ? dot.bottom : undefined,
            }}
          />
        ))}

        <Sparkles className="absolute left-[18%] top-6 h-5 w-5 animate-pulse text-white/70" />
        <PartyPopper className="absolute bottom-5 right-[28%] hidden h-5 w-5 animate-bounce text-white/70 sm:block" />
      </div>

      <div className="relative rounded-[14px] bg-white/90 p-5 backdrop-blur-sm sm:p-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full border border-white/70 bg-white/80 text-slate-600 shadow-sm hover:bg-white hover:text-slate-900"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col gap-5 pr-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 shadow-md shadow-fuchsia-500/30">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white shadow-sm animate-pulse">
                  <Sparkles className="h-3.5 w-3.5" />
                  Now live
                </span>
                <h2 className="mt-2 text-lg font-bold text-slate-900 sm:text-xl">
                  Autoresponder is now available
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Celebrate smarter email — automate follow-ups from captured leads, send one-off
                  broadcasts, and build drip sequences right inside your advertiser portal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FEATURE_CHIPS.map(({ label, icon: Icon, className, iconClassName }) => (
                <span
                  key={label}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm",
                    className,
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <ButtonLink
              href="/advertiser/email"
              className="h-10 rounded-xl border-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 px-4 text-white shadow-md shadow-fuchsia-500/30 hover:opacity-95"
            >
              <Mail className="mr-2 h-4 w-4" />
              Open Autoresponder
            </ButtonLink>
            <ButtonLink
              href="/advertiser/email/wallet"
              variant="outline"
              className="h-10 rounded-xl border-slate-200/80 bg-white/80 px-4 text-slate-700 backdrop-blur-sm hover:bg-white"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Top up email wallet
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
