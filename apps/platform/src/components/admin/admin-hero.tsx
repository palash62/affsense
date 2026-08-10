"use client";

import { useEffect, useState } from "react";
import { Megaphone, Building2 } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

interface AdminHeroProps {
  userName?: string;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function AdminHero({ userName = "Admin" }: AdminHeroProps) {
  const [greeting, setGreeting] = useState("Welcome");

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-[18px] px-6 py-5 shadow-md"
      style={{
        backgroundImage: "linear-gradient(to right, var(--theme-hero-from), var(--theme-hero-to))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white" />
        <div className="absolute bottom-0 left-1/4 h-24 w-24 rounded-full bg-white" />
        <div className="absolute right-1/3 top-1/2 h-16 w-16 rotate-45 rounded-lg bg-white" />
      </div>

      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">
            Platform Control Center
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-[1.65rem]">
            {greeting}, {userName}
          </h1>
          <p className="mt-1.5 max-w-lg text-sm text-white/80">
            Monitor your Affsense platform from one powerful dashboard.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2.5">
          <ButtonLink
            href="/admin/campaigns"
            className="rounded-xl bg-card px-4 text-[var(--theme-hero-btn-text)] shadow-sm hover:bg-card/90"
          >
            <Megaphone className="mr-2 h-4 w-4" />
            Create Campaign
          </ButtonLink>
          <ButtonLink
            href="/admin/advertisers"
            variant="outline"
            className="rounded-xl border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
          >
            <Building2 className="mr-2 h-4 w-4" />
            Add Advertiser
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
