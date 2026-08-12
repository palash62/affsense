"use client";

import { useEffect, useState } from "react";
import { Mail, Send, Users, Wallet, X, Zap } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";

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
  { label: "Automations", icon: Zap },
  { label: "Broadcasts", icon: Send },
  { label: "Subscriber tools", icon: Users },
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
    <div className="premium-card relative overflow-hidden">
      <div className="h-1" style={{ background: "var(--theme-gradient-approved)" }} />
      <div
        className="p-5 sm:p-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--theme-primary-soft) 85%, white) 0%, white 55%)",
        }}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-3 top-3 h-8 w-8 rounded-lg text-slate-500 hover:bg-white/80 hover:text-slate-800"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex flex-col gap-5 pr-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <Mail className="h-5 w-5 text-[var(--theme-primary)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-primary)]">
                  New
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-slate-900 sm:text-xl">
                  Autoresponder is now available
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Automate follow-ups from captured leads, send one-off broadcasts, and build drip
                  sequences — all inside your advertiser portal.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {FEATURE_CHIPS.map(({ label, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-[var(--theme-primary)]" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <ButtonLink
              href="/advertiser/email"
              className="h-10 rounded-xl bg-[var(--theme-primary)] px-4 hover:opacity-90"
            >
              <Mail className="mr-2 h-4 w-4" />
              Open Autoresponder
            </ButtonLink>
            <ButtonLink
              href="/advertiser/email/wallet"
              variant="outline"
              className="h-10 rounded-xl border-slate-200 bg-white px-4 text-slate-700 hover:bg-slate-50"
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
