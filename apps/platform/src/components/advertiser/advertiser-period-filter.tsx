"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { ADVERTISER_PERIODS } from "@/lib/advertiser-periods";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AdvertiserPeriodFilter({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const label = ADVERTISER_PERIODS.find((p) => p.value === current)?.label ?? "Last 30 Days";

  function setPeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            disabled={isPending}
            className="h-9 gap-2 rounded-lg border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm"
          />
        }
      >
        <CalendarDays className="h-4 w-4 text-[var(--theme-primary)]" />
        {label}
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={current} onValueChange={setPeriod}>
          {ADVERTISER_PERIODS.map((p) => (
            <DropdownMenuRadioItem key={p.value} value={p.value}>
              {p.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
