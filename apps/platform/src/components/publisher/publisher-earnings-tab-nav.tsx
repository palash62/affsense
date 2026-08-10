"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Banknote, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublisherEarningsTab = "earnings" | "payouts";

const TABS: { value: PublisherEarningsTab; label: string; icon: typeof TrendingUp }[] = [
  { value: "earnings", label: "Earnings", icon: TrendingUp },
  { value: "payouts", label: "Payouts", icon: Banknote },
];

export function PublisherEarningsTabNav({ active }: { active: PublisherEarningsTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setTab(tab: PublisherEarningsTab) {
    if (tab === active) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page");
    params.delete("sort");
    if (tab === "earnings") {
      params.delete("status");
      params.delete("method");
      params.delete("from");
      params.delete("to");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 rounded-2xl border-2 border-border bg-muted p-2.5 shadow-sm",
        isPending && "opacity-70",
      )}
      role="tablist"
      aria-label="Earnings and payouts"
    >
      {TABS.map(({ value, label, icon: Icon }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setTab(value)}
            className={cn(
              "flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-base font-bold transition-all",
              isActive
                ? "bg-[var(--theme-primary)] text-white shadow-md ring-2 ring-[var(--theme-primary)]/25"
                : "bg-card text-muted-foreground ring-1 ring-slate-200 hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
